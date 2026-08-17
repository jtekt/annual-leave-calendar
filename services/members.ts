import axios from "axios"
import { extractAuthHeaders } from "../utils"
import { NotFoundError, UnauthorizedError, ValidationError } from "../errors"

const {
  USER_MANAGER_API_URL,
  GROUP_MANAGER_API_URL,
  WORKPLACE_MANAGER_API_URL,
} = process.env

/**
 * Fetches group members from the Group Manager API
 */
export async function fetchGroupMembers(
  groupId: string,
  reqHeaders: Record<string, any>,
  batchSize: number = 10000,
  startIndex: number = 0
) {
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
    if (status === 403 || status === 401) {
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
    if (status === 403 || status === 401) {
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
  try {
    const headers = extractAuthHeaders(reqHeaders)
    const res = await axios.get(`${USER_MANAGER_API_URL}/${user_id}`, {
      headers,
    })
    return res.data
  } catch (error: any) {
    const status = error?.response?.status ?? 500
    const code = error?.code
    if (status === 403 || status === 401) {
      throw new UnauthorizedError("Unauthorized to access USER_MANAGER_API")
    } else if (status === 404) {
      throw new NotFoundError("USER_MANAGER_API", user_id)
    } else {
      throw new ValidationError("Failed to fetch from USER_MANAGER_API")
    }
  }
}
