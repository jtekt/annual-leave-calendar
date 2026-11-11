import axios from "axios"
import { buildUserObj, extractAuthHeaders } from "../utils"
import {
  ForbiddenError,
  NotFoundError,
  NotImplementedError,
  UnauthorizedError,
  ValidationError,
} from "../errors"
import UserModel from "../models/user"

const { STANDALONE_MODE } = process.env

// ----- Standalone Functions -----

export async function listGroupsFromDB() {
  const { STANDALONE_GROUPS_KEY } = process.env
  if (!STANDALONE_GROUPS_KEY)
    throw new NotImplementedError("STANDALONE_GROUPS_KEY is not set")
  return UserModel.aggregate([
    { $match: { [`properties.${STANDALONE_GROUPS_KEY}`]: { $exists: true } } },
    { $unwind: `$properties.${STANDALONE_GROUPS_KEY}` },
    {
      $group: {
        _id: `$properties.${STANDALONE_GROUPS_KEY}`,
        member_count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
}

export async function listWorkplacesFromDB() {
  const { STANDALONE_WORKPLACE_KEY } = process.env
  if (!STANDALONE_WORKPLACE_KEY)
    throw new NotImplementedError("STANDALONE_WORKPLACE_KEY is not set")
  return UserModel.aggregate([
    {
      $match: {
        [`properties.${STANDALONE_WORKPLACE_KEY}`]: { $exists: true },
      },
    },
    {
      $group: {
        _id: `$properties.${STANDALONE_WORKPLACE_KEY}`,
        member_count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
}

export async function listUsersFromDB(
  search?: string,
  batchSize: number = 50,
  startIndex: number = 0
) {
  search = search?.trim()

  const query = search
    ? {
        $or: [
          {
            [`properties.${process.env.STANDALONE_USER_NAME_KEY}`]: {
              $regex: search,
              $options: "i",
            },
          },
          {
            [`properties.${process.env.STANDALONE_USER_EMAIL_KEY}`]: {
              $regex: search,
              $options: "i",
            },
          },
        ],
      }
    : {}
  const [users, count] = await Promise.all([
    UserModel.find(query).skip(startIndex).limit(batchSize).lean(),
    UserModel.countDocuments(query),
  ])
  return {
    count,
    users: users.map((u) => ({
      ...u.properties,
      ...buildUserObj(u.user_id, u.properties ?? {}),
    })),
  }
}

export async function getUserFromDB(user_id: string) {
  const user = await UserModel.findOne({ user_id }).lean()
  if (!user) throw new NotFoundError("UserModel", user_id)
  return {
    ...user.properties,
    ...buildUserObj(user.user_id, user.properties ?? {}),
  }
}

// ----- API Fetch Functions -----

/**
 * Fetches group members from the Group Manager API
 */
export async function fetchGroupMembers(
  groupId: string,
  reqHeaders: Record<string, any>,
  batchSize: number = 10000,
  startIndex: number = 0
) {
  const { GROUP_MANAGER_API_URL, STANDALONE_GROUPS_KEY } = process.env

  if (!GROUP_MANAGER_API_URL) {
    if (!STANDALONE_MODE || !STANDALONE_GROUPS_KEY)
      throw new NotImplementedError(
        "Groups are not available: GROUP_MANAGER_API_URL is not set"
      )
    const query = { [`properties.${STANDALONE_GROUPS_KEY}`]: groupId }
    const [rawUsers, total_of_users] = await Promise.all([
      UserModel.find(query).skip(startIndex).limit(batchSize).lean(),
      UserModel.countDocuments(query),
    ])
    const users = rawUsers.map((u) => ({
      user_id: u.user_id,
      properties: u.properties,
      ...buildUserObj(u.user_id, u.properties ?? {}),
    }))
    return { users, total_of_users, limit_of_users: batchSize }
  }

  try {
    const url = `${GROUP_MANAGER_API_URL}/v3/groups/${groupId}/members`
    const headers = extractAuthHeaders(reqHeaders)
    const reqParams = {
      batch_size: batchSize,
      start_index: startIndex,
    }

    const { data } = await axios.get(url, { headers, params: reqParams })

    return {
      users: data.items,
      total_of_users: data.count,
      limit_of_users: data.batch_size,
    }
  } catch (error: any) {
    const status = error?.response?.status ?? 500
    if (status === 403) {
      throw new ForbiddenError(
        "GROUP_MANAGER_API_URL",
        "Not allowed to access this resource"
      )
    } else if (status === 401) {
      throw new UnauthorizedError(
        "Unauthorized to access GROUP_MANAGER_API_URL"
      )
    } else if (status === 404) {
      throw new NotFoundError("GROUP_MANAGER_API_URL", groupId)
    } else {
      throw new ValidationError("Failed to fetch from GROUP_MANAGER_API_URL")
    }
  }
}

/**
 * Fetches workplace employees from the Workplace Manager API
 */
export async function fetchWorkplaceEmployees(
  workplaceId: string,
  reqHeaders: Record<string, any>,
  batchSize: number = 10000,
  startIndex: number = 0
) {
  const { WORKPLACE_MANAGER_API_URL, STANDALONE_WORKPLACE_KEY } = process.env

  if (!WORKPLACE_MANAGER_API_URL) {
    if (!STANDALONE_MODE || !STANDALONE_WORKPLACE_KEY)
      throw new NotImplementedError(
        "Workplaces are not available: WORKPLACE_MANAGER_API_URL is not set"
      )
    const query = { [`properties.${STANDALONE_WORKPLACE_KEY}`]: workplaceId }
    const [rawUsers, total_of_users] = await Promise.all([
      UserModel.find(query).skip(startIndex).limit(batchSize).lean(),
      UserModel.countDocuments(query),
    ])
    const users = rawUsers.map((u) => ({
      user_id: u.user_id,
      properties: u.properties,
      ...buildUserObj(u.user_id, u.properties ?? {}),
    }))
    return { users, total_of_users, limit_of_users: batchSize }
  }

  try {
    const url = `${WORKPLACE_MANAGER_API_URL}/v2/workplaces/${workplaceId}/employees`
    const headers = extractAuthHeaders(reqHeaders)
    const reqParams = {
      batch_size: batchSize,
      start_index: startIndex,
    }

    const { data, headers: workplaceResHeader } = await axios.get(url, {
      headers,
      params: reqParams,
    })

    return {
      users: data,
      total_of_users: Number(workplaceResHeader["x-total"]),
      limit_of_users: batchSize,
    }
  } catch (error: any) {
    const status = error?.response?.status ?? 500
    if (status === 403) {
      throw new ForbiddenError(
        "WORKPLACE_MANAGER_API_URL",
        "Not allowed to access this resource"
      )
    } else if (status === 401) {
      throw new UnauthorizedError(
        "Unauthorized to access WORKPLACE_MANAGER_API_URL"
      )
    } else if (status === 404) {
      throw new NotFoundError("WORKPLACE_MANAGER_API_URL", workplaceId)
    } else {
      throw new ValidationError(
        "Failed to fetch from WORKPLACE_MANAGER_API_URL"
      )
    }
  }
}

export const fetchUserData = async (
  user_id: string,
  reqHeaders: Record<string, any>
) => {
  const { USER_MANAGER_API_URL } = process.env

  if (!USER_MANAGER_API_URL) {
    if (!STANDALONE_MODE)
      throw new NotImplementedError("USER_MANAGER_API_URL is not set")
    const user = await UserModel.findOne({ user_id })
    if (!user) throw new NotFoundError("UserModel", user_id)
    return user
  }

  try {
    const headers = extractAuthHeaders(reqHeaders)
    const res = await axios.get(`${USER_MANAGER_API_URL}/${user_id}`, {
      headers,
    })
    return res.data
  } catch (error: any) {
    const status = error?.response?.status ?? 500
    if (status === 403) {
      throw new ForbiddenError(
        "USER_MANAGER_API",
        "Not allowed to access this resource"
      )
    } else if (status === 401) {
      throw new UnauthorizedError("Unauthorized to access USER_MANAGER_API")
    } else if (status === 404) {
      throw new NotFoundError("USER_MANAGER_API", user_id)
    } else {
      throw new ValidationError("Failed to fetch from USER_MANAGER_API")
    }
  }
}
