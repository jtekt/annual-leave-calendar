interface IAllocation  {
    _id: string
    year: number
    user_id: string
    leaves: {
        current_year_grants: number;
        carried_over: number;
        target?: number;
    }
    reserve: {
        current_year_grants: number;
        carried_over: number;
    }
  }

  export default IAllocation
  