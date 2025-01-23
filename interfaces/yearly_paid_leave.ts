interface IYearly_paid_leave  {
    _id: string
    year: number
    user_id: string
    annual_paid_leave: {
        days_carried_over: number;
        days_granted: number;
    }
  }
  
  export default IYearly_paid_leave
  