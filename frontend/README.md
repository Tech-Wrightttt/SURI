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

## Guided tutorials

First visits show a skippable guide for the dashboard, topic library and overview, calculator, progress, playground, lessons, diagnostic, practice, quiz, and results. Battle guides start in the main battle, with no tutorials on diagnostic, practice, or quiz introductions. Every step has Continue and Back controls. Highlighted controls are optional, and missing or disabled elements never block the guide. Quiz timers pause while the guide is active.

Use **Tutorial** in the page header to replay a guide. Session pages have a floating Tutorial button. Login and registration have no tutorials. Completed/skipped guides and the skip-all preference are stored locally per student in this browser. Existing students also receive each guide once.

Guide content and readiness selectors live in `lib/tutorials.ts`. Add `data-tutorial` hooks for controls and `data-tutorial-scope` for pages with several views, such as quiz phases. The shared provider highlights visible targets without intercepting page interactions. Phone and tablet guides use touch-friendly sheets with persistent navigation, scrollable text, and positioning that accounts for the visible viewport and math keyboard.

Run the tutorial regression checks with `node scripts/test-tutorials.cjs`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
