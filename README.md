# JoeyJob

Welcome to JoeyJob! 

## Getting Started

To run this application:

```bash
npm install
npm run dev
```

## Building For Production

To build this application for production:

```bash
npm run build
npm run start
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
npm run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Routing

This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a file based router. Which means that the routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'

export default function MyComponent() {
  return (
    <div>
      <Link to="/about">About</Link>
    </div>
  )
}
```

## Taali Library

This project includes the Taali shared component library as a Git subtree. To manage the Taali library:

- **Pull updates:** `npm run taali:pull`
- **Push changes:** `npm run taali:push`
- **Check status:** `npm run taali:status`

## Environment Variables

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

## License

© 2024 JoeyJob. All rights reserved.