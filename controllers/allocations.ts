import Allocation from "../models/allocation";
import createHttpError from "http-errors";
import { DEFAULT_BATCH_SIZE } from "../constants";
import { Request, Response } from "express";

export const create_allocation = async (req: Request, res: Response) => {
  const {
    year,
    user_id,
    leaves = { current_year_grants: 0, carried_over: 0 },
    reserve = { current_year_grants: 0, carried_over: 0 },
  } = req.body;

  if (!user_id) throw createHttpError(400, `User ID not provided`);
  if (!year) throw createHttpError(400, `Year not provided`);

  const entry_properties = {
    year,
    user_id,
    leaves,
    reserve,
  };

  const filter = { year, user_id };
  const options = { new: true, upsert: true };

  const allocation = await Allocation.findOneAndUpdate(
    filter,
    entry_properties,
    options
  );

  res.send(allocation);
};

export const get_single_allocation = async (req: Request, res: Response) => {
  const { _id } = req.params;
  if (!_id) throw createHttpError(400, `ID is not provided`);

  const allocation = await Allocation.findById(_id);
  res.send(allocation);
};

export const get_all_allocations = async (req: Request, res: Response) => {
  const {
    year,
    user_id,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any;

  const query: any = {};
  if (year) query.year = year;
  if (user_id) query.user_id = user_id;

  const allocations = await Allocation.find(query)
    .sort({ user_id, year })
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0));

  const total = await Allocation.countDocuments(query);

  const response = {
    year,
    user_id,
    limit,
    skip,
    total,
    allocations,
  };

  res.send(response);
};

export const update_allocation = async (req: Request, res: Response) => {
  const { _id } = req.params;

  if (!_id) throw createHttpError(400, `ID is not provided`);

  const result = await Allocation.updateOne({ _id }, req.body);

  res.send(result);
};

export const delete_allocation = async (req: Request, res: Response) => {
  const { _id } = req.params;

  if (!_id) throw createHttpError(400, `ID is not provided`);

  const result = await Allocation.deleteOne({ _id });
  res.send(result);
};
