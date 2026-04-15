// Allow importing CSS files for their side effects (e.g. `import "katex/dist/katex.min.css"`).
// Next.js' TypeScript plugin handles this at build time; this declaration is for the IDE's
// plain TypeScript language server so it doesn't flag `.css` imports as "Cannot find module".
declare module "*.css";
