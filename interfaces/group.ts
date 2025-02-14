import IEntry from "./entry"
import IAllocation from "./allocation"
interface IGroup {
  _id?: string
  properties?: {
    _id: string
  }
  entries: IEntry[]
  allocations: IAllocation
}

export default IGroup
