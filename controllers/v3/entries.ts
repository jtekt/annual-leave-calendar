import axios from "axios"
import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { collectByKeys, getUserId, getUsername, resolveUserEntryFields, resolveUserQuery } from "../../utils"
import IEntry from "../../interfaces/entry"
import IAllocation from "../../interfaces/allocation"
import { get_user_allocations_by_year, get_user_array_allocations_by_year } from "./allocations"

import { DEFAULT_BATCH_SIZE } from "../../constants"
import { Request, Response } from "express"

const { GROUP_MANAGER_API_URL, WORKPLACE_MANAGER_API_URL } = process.env

export const get_entries_of_user = async (req: Request, res: Response) => {
  let identifier: string | undefined = req.params.identifier
  if (!identifier) {
    console.log("here > !identifier")
    throw createHttpError(400, `User not authenticated or ID not provided`);
  } else if (identifier === "self" && !res.locals.user) {
    console.log("here > !res.locals.user")
    throw createHttpError(401, `User not authenticated or ID not provided`);
  }

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
  } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  let identifierQuery = resolveUserQuery({ identifier, user: res.locals.user })
  const query = {
    $and: [
      identifierQuery,
      {
        date: { $gte: start_of_date, $lte: end_of_date },
      },
    ],
  };
  const entries = await Entry.find(query).sort("date")

  const allocations = await get_user_allocations_by_year(year, identifierQuery)

  res.send({ entries, allocations })
}
export const create_entry = async (req: Request, res: Response) => {
  const {
    date,
    type = "有休",
    am = true,
    pm = true,
    taken = false,
    refresh = false,
    plus_one = false,
    reserve = false,
    user_id,
    preferred_username
  } = req.body;

  const identifier = req.params.identifier;

  if (!date) {
    throw createHttpError(400, "Date not provided");
  }

  let userFields: any;
  if (identifier) {
    if (identifier === "self") {
      if (!res.locals.user) {
        throw createHttpError(401, "User identifier not provided");
      }
      userFields = resolveUserEntryFields(res.locals.user);
    } else
      userFields = { preferred_username: identifier };

  } else if (user_id || preferred_username) {
    userFields = {};
    if (user_id) userFields.user_id = user_id;
    if (preferred_username) userFields.preferred_username = preferred_username;
  } else {
    throw createHttpError(400, "User identifier not provided");
  }

  const entryProperties = {
    ...userFields,
    date,
    type,
    am,
    pm,
    taken,
    refresh,
    plus_one,
    reserve,
  };

  const filter = { date, ...userFields };
  const options = { new: true, upsert: true };

  const entry = await Entry.findOneAndUpdate(filter, entryProperties, options);

  res.send(entry);
};

export const get_all_entries = async (req: Request, res: Response) => {
  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    identifiers,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const query: any = {
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  if (identifiers) {
    const userIdArray = Array.isArray(identifiers) ? identifiers : [identifiers];
    query.$or = userIdArray.flatMap((id: string) => [
      { user_id: id },
      { preferred_username: id },
    ]);
  }

  const entries = await Entry.find(query)
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Entry.countDocuments(query)

  const response = {
    start_of_date,
    end_of_date,
    limit,
    skip,
    total,
    entries,
  }

  res.send(response)
}

export const get_entries_of_group = async (req: Request, res: Response) => {
  const { group_id } = req.params

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  let users: any[]
  let total_of_users: number
  try {
    const url = `${GROUP_MANAGER_API_URL}/v3/groups/${group_id}/members`
    const headers = { authorization: req.headers.authorization }
    const params = {
      batch_size: limit,
      start_index: skip,
    }

    const { data } = await axios.get(url, { headers, params })
    const { items, count } = data
    users = items
    total_of_users = count
  } catch (error: any) {
    const { response = {} } = error
    const { status = 500, data = "Failed to query group members" } = response
    throw createHttpError(status, data)
  }

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const identifiers = users.flatMap(user => {
    const ids: { user_id?: string; preferred_username?: string }[] = [];

    const user_id = getUserId(user);
    const username = getUsername(user);

    if (user_id && username) {
      ids.push({ user_id }, { preferred_username: username });
    } else if (user_id) {
      ids.push({ user_id });
    } else if (username) {
      ids.push({ preferred_username: username });
    }

    return ids;
  });

  if (!identifiers.length)
    throw createHttpError(404, `Group ${group_id} appears to be empty`)

  const query = {
    $and: [
      { $or: identifiers },
      { date: { $gte: start_of_date, $lte: end_of_date } },
    ]
  };

  const entries = await Entry.find(query).sort("date")

  const entries_mapping = collectByKeys<IEntry>(
    entries,
    (entry) => [entry.user_id, (entry as any).preferred_username],
    (acc, entry, key) => {
      acc[key] = acc[key] || [];
      acc[key].push(entry);
    }
  );

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    identifiers
  )

  const allocations_mapping = collectByKeys<IAllocation>(
    result_allocations.allocations,
    (allocation) => [allocation.user_id, (allocation as any).preferred_username],
    (acc, allocation, key) => {
      acc[key] = allocation;
    }
  );

  const output = users.map((user: any) => {
    const keys = [getUserId(user), getUsername(user)].filter(Boolean);
    if (!keys.length) throw new Error("User has no user_id or preferred_username");

    const entries: IEntry[] = Array.from(
      new Map(
        keys
          .flatMap(key => entries_mapping[key] || [])
          .map(entry => [entry._id.toString(), entry])
      ).values()
    );
    const allocations = keys.map(key => allocations_mapping[key]).find(Boolean) || null;

    // FIXME: Two formats?
    // user.entries = entries
    return { user, entries, allocations }
  })

  const response = {
    start_of_date,
    end_of_date,
    limit,
    skip,
    total: total_of_users,
    items: output,
  }

  res.send(response)
}

export const get_entries_of_workplace = async (req: Request, res: Response) => {
  const { workplace_id } = req.params

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  let users: any[]
  let total_of_users: number
  try {
    const url = `${WORKPLACE_MANAGER_API_URL}/v2/workplaces/${workplace_id}/employees`
    const headers = { authorization: req.headers.authorization }
    const params = {
      batch_size: limit,
      start_index: skip,
    }

    const { data, headers: workplaceResHeader } = await axios.get(url, {
      headers,
      params,
    })
    users = data
    total_of_users = Number(workplaceResHeader["x-total"])
  } catch (error: any) {
    const { response = {} } = error
    const { status = 500, data = "Failed to query workplace members" } =
      response
    throw createHttpError(status, data)
  }

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const identifiers = users.flatMap(user => {
    const user_id = getUserId(user);
    const preferred_username = getUsername(user);

    const clauses: { user_id?: string; preferred_username?: string }[] = [];

    if (user_id) clauses.push({ user_id });
    if (preferred_username) clauses.push({ preferred_username });

    return clauses;
  });

  if (!identifiers.length)
    throw createHttpError(404, `Workplace ${workplace_id} appears to be empty`)

  const query = {
    $or: identifiers,
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  const entries = await Entry.find(query).sort("date")

  const entries_mapping = collectByKeys<IEntry>(
    entries,
    (entry) => [entry.user_id, (entry as any).preferred_username],
    (acc, entry, key) => {
      acc[key] = acc[key] || [];
      acc[key].push(entry);
    }
  );

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    identifiers
  )

  const allocations_mapping = collectByKeys<IAllocation>(
    result_allocations.allocations,
    (allocation) => [allocation.user_id, (allocation as any).preferred_username],
    (acc, allocation, key) => {
      acc[key] = allocation;
    }
  );

  const output = users.map((user: any) => {
    const keys = [getUserId(user), getUsername(user)].filter(Boolean);
    if (!keys.length) throw new Error("User has no user_id or preferred_username");

    const entries: IEntry[] = Array.from(
      new Map(
        keys
          .flatMap(key => entries_mapping[key] || [])
          .map(entry => [entry._id.toString(), entry])
      ).values()
    );
    const allocations = keys.map(key => allocations_mapping[key]).find(Boolean) || null;

    // FIXME: Two formats?
    // user.entries = entries
    return { user, entries, allocations }
  })

  const response = {
    start_of_date,
    end_of_date,
    limit,
    skip,
    total: total_of_users,
    items: output,
  }

  res.send(response)
}
