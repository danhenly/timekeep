This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## MSSQL API Route

This project includes an API route that reads from a local MSSQL view:

- Route: `GET /api/view`
- Handler: `app/api/view/route.ts`

This project also includes a leaves route:

- Route: `GET /api/leaves`
- Handler: `app/api/leaves/route.ts`

This project also includes a holidays route:

- Route: `GET /api/holidays`
- Handler: `app/api/holidays/route.ts`

Set environment variables in `.env.local` (you can copy from `.env.example`):

```bash
MSSQL_SERVER=localhost
MSSQL_PORT=1433
MSSQL_USER=sa
MSSQL_PASSWORD=your_password
MSSQL_DATABASE=your_database
MSSQL_VIEW_NAME=dbo.YourViewName
MSSQL_LEAVES_VIEW_NAME=dbo.YourLeavesFiledView
MSSQL_HOLIDAYS_VIEW_NAME=dbo.YourHolidaysView
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true
```

Then run `pnpm dev` and call `http://localhost:3000/api/view`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
