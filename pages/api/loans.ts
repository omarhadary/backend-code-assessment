import type { NextApiRequest, NextApiResponse } from 'next'

import camelcaseKeys from 'camelcase-keys'

import { getClient } from 'src/database'

//can put in a constants file for other endpoints files to use
const defaultPageSize: number = 10

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const client = getClient()

  let { page, pageSize } = _req.query
  const { limit, offset } = buildPaginationProperties(page, pageSize)

  try {
    await client.connect()

    const rowCount = await client.query(`
      select
          count(*)
      from loan t1
      left join address t2
            on t1.address_id = t2.id
      left join company t3
            on t1.company_id = t3.id
      `)

    const result = await client.query(`
      select
          t1.*,
          t2.address_1,
          t2.city,
          t2.state,
          t2.zip_code,
          t3.name as company_name
      from loan t1
      left join address t2
          on t1.address_id = t2.id
      left join company t3
          on t1.company_id = t3.id
          order by t1.id asc
          limit ${limit} 
          offset ${offset}
      `)

    res.status(200).json([camelcaseKeys(result.rows), rowCount.rows[0].count])
  } catch (err: any) {
    console.log(err)
    res.status(500).send(err.message)
  } finally {
    await client.end()
  }
}

const buildPaginationProperties = (page: string | string[], pageSize: string | string[]): { limit: number, offset: number } => {
  //although default page and pageSize are set in index.tsx, 
  // we handle here as well in the event a different client uses this endpoint
  let offset: number = 0
  let limit: number = defaultPageSize

  if (page) {
    offset = Number(limit) * Number(page)
  }
  if (pageSize) {
    limit = pageSize as unknown as number;
  }
  return { limit, offset };
}