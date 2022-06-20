import type { NextApiRequest, NextApiResponse } from 'next'

import camelcaseKeys from 'camelcase-keys'

import { getClient } from 'src/database'

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const client = getClient()

  let { page, pageSize, searchTerm } = _req.query
  const limit = pageSize as unknown as number;
  const offset = limit * Number(page)
  const searchClause = searchTerm ?
    `
    where
        lower(t2.address_1) like '%${searchTerm.toString().trim()}%'
        or lower(t3.name) like '%${searchTerm.toString().trim()}%'
    `
    : ""
  try {
    await client.connect()

    //Todo - look into using an ORM like Sequelize or executing stored procedures that return multiple datasets
    const rowCount = await client.query(`
      select
          count(*)
      from loan t1
      left join address t2
            on t1.address_id = t2.id
      left join company t3
            on t1.company_id = t3.id            
      ${searchClause} 
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
      ${searchClause} 
      order by 
          t1.id asc
      limit ${limit} 
      offset ${offset}
      `)

    const totalLoanAmounts = await client.query(`
      select 
          sum(amount)
      from (
          select
              t1.amount
          from loan t1
          left join address t2
              on t1.address_id = t2.id
          left join company t3
              on t1.company_id = t3.id
          ${searchClause}
          order by 
              t1.id asc
          limit ${limit} 
          offset ${offset}
      ) total
      `)

    res.status(200).json(
      [
        camelcaseKeys(result.rows),
        rowCount.rows[0].count,
        totalLoanAmounts.rows[0].sum
      ]
    )
  } catch (err: any) {
    console.log(err)
    res.status(500).send(err.message)
  } finally {
    await client.end()
  }
}