import axios, { AxiosError } from "axios"

const main = async () => {
  try {
    const { data } = await axios.get("http://10.115.1.100:30091/caca")
    console.log(data)
  } catch (error: any) {
    console.log(error.response.status)
  }
}

main()
