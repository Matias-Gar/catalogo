# GitHub Copilot Instructions for Catalogo

## Project Overview

This is a Next.js-based e-commerce catalog and inventory management application ("Catalogo"). The application provides:

- **Public catalog**: Product browsing with promotions, discounts, and pack deals
- **Admin panel**: Product management, payment tracking, inventory control, and WhatsApp integration
- **Customer profiles**: User authentication and profile management with Firebase and Supabase
- **WhatsApp integration**: Automated notifications and catalog sharing via WhatsApp API
- **Facebook integration**: Product catalog sync with Facebook for marketing

**Target audience**: Small to medium-sized businesses managing product catalogs and sales through multiple channels (web, WhatsApp, Facebook).

## Technology Stack

### Core Framework & Language
- **Next.js 16** (App Router with React Server Components)
- **React 19** (with React DOM 19)
- **TypeScript 5** (with JavaScript files for legacy components)
- **Node.js 20+**

### Backend & Database
- **Supabase** (PostgreSQL database, authentication, storage)
- **Firebase** (authentication alternative)

### Styling & UI
- **Tailwind CSS 4** (utility-first CSS framework)
- **Radix UI** (accessible UI components)
- **Lucide React** (icon library)
- **Framer Motion** (animations)

### Additional Libraries
- **Chart.js / React-Chartjs-2** (data visualization)
- **jsPDF / jsPDF-AutoTable** (PDF generation for reports)
- **React-Barcode** (barcode generation)
- **React-Hot-Toast / React-Toastify** (notifications)
- **DOMPurify** (XSS protection)

### Development Tools
- **ESLint** (code linting)
- **Turbopack** (Next.js bundler)

## Coding Guidelines & Standards

### General Principles
- Keep code simple, readable, and maintainable
- Follow the DRY (Don't Repeat Yourself) principle
- Write self-documenting code with clear variable and function names
- Use Spanish for user-facing text and database fields (as this is a Spanish-language application)

### JavaScript/TypeScript
- **File naming**: Use camelCase for JS/TS files (e.g., `SupabaseClient.js`, `usePromociones.js`)
- **Component naming**: Use PascalCase for React components
- **Function naming**: Use camelCase for functions and variables
- **Prefer functional components**: Use React functional components with hooks
- **Client/Server components**: 
  - Mark client components with `"use client"` directive
  - Keep server components default (no directive needed)
  - Minimize client-side JavaScript by using server components where possible
- **TypeScript**: Use TypeScript for new utility files; JavaScript is acceptable for component files
- **Exports**: Use named exports (avoid default exports)
- **Path aliases**: Use `@/` for imports (e.g., `import { supabase } from '@/lib/SupabaseClient'`)

### React Patterns
- **Hooks**: Use built-in React hooks (`useState`, `useEffect`, etc.)
- **Custom hooks**: Create custom hooks for reusable logic (prefix with `use`, e.g., `usePromociones`, `useUserProfile`)
- **State management**: Use React Context or local state; avoid prop drilling
- **Error boundaries**: Handle errors gracefully with try-catch and user feedback

### Styling
- **Tailwind CSS**: Use Tailwind utility classes for styling
- **Responsive design**: Mobile-first approach with responsive breakpoints (`sm:`, `md:`, `lg:`, etc.)
- **Consistent spacing**: Use Tailwind's spacing scale (e.g., `p-4`, `mt-2`, `gap-6`)
- **Accessibility**: Include ARIA labels and semantic HTML

### API Routes
- **Route handlers**: Use Next.js route handlers in `/app/api/` directory
- **File naming**: Use `route.js` or `route.ts` for API endpoints
- **HTTP methods**: Export functions named after HTTP methods (`GET`, `POST`, etc.)
- **Error handling**: Return proper HTTP status codes and error messages

### Database & Supabase
- **Client initialization**: Use the singleton Supabase client from `lib/SupabaseClient.js`
- **Query patterns**: Use Supabase's query builder methods (`.select()`, `.insert()`, `.update()`, `.delete()`)
- **Real-time subscriptions**: Use `.on('postgres_changes')` for live updates when needed
- **Storage**: Use Supabase Storage for images with public buckets

## Project Structure

```
/app                    # Next.js app directory (App Router)
  /admin               # Admin panel pages
    /pagos             # Payment management
    /productos         # Product management
    /promociones       # Promotions and discounts
    /whatsapp          # WhatsApp integration
  /api                 # API route handlers
    /facebook          # Facebook catalog API
    /whatsapp          # WhatsApp webhook and commands
    /image-proxy       # Image proxy for external sources
  /login               # Authentication pages
  /perfil              # User profile pages
  /productos           # Public product pages
  layout.tsx           # Root layout
  page.js              # Home page (product catalog)
  globals.css          # Global styles

/components            # Reusable React components
  /ui                  # UI components (shadcn/ui style)
  AuthForm.js          # Authentication forms
  Header.js            # Site header
  ProductCard.js       # Product display card
  UserProfile.js       # User profile component
  PerfilForm.js        # Profile editing form

/lib                   # Utility functions and shared logic
  SupabaseClient.js    # Supabase client singleton
  promociones.js       # Promotion calculation logic
  packs.js             # Pack/bundle discount logic
  usePromociones.js    # Promotions custom hook
  useUserProfile.js    # User profile custom hook

/database              # SQL migration files
  *.sql                # Database schema and migrations

/public                # Static assets (images, fonts, etc.)
```

## Security Guidelines

### Authentication & Authorization
- **Never commit API keys, secrets, or credentials** to the repository
- Use environment variables for all sensitive data (stored in `.env.local`)
- Validate user authentication before accessing protected routes
- Implement proper role-based access control for admin features

### Data Validation
- **Sanitize all user inputs** before processing or storing
- Use DOMPurify for HTML content to prevent XSS attacks
- Validate data types and formats on both client and server
- Use parameterized queries (Supabase query builder) to prevent SQL injection

### API Security
- Validate webhook signatures (e.g., WhatsApp webhook verification)
- Implement rate limiting for public API endpoints
- Return appropriate error messages without exposing sensitive information
- Use HTTPS for all external API calls

### Dependencies
- Keep dependencies up to date with security patches
- Review dependency changes before updating major versions
- Avoid adding unnecessary dependencies

## Common Patterns & Examples

### Fetching Products from Supabase
```javascript
const { data: productos, error } = await supabase
  .from('productos')
  .select('*')
  .order('nombre', { ascending: true });
```

### Using Promotions
```javascript
import { PrecioConPromocion } from '@/lib/promociones';
import { usePromociones } from '@/lib/usePromociones';

const promociones = usePromociones();
const precioFinal = PrecioConPromocion(producto, promociones);
```

### Client Component with State
```javascript
"use client";

import { useState, useEffect } from 'react';

export default function MiComponente() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    // Fetch data
  }, []);
  
  return <div>{/* render */}</div>;
}
```

### API Route Handler
```javascript
export async function GET(request) {
  try {
    // Handle request
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Error message' }, { status: 500 });
  }
}
```

## Testing & Quality

- Run `npm run lint` before committing to ensure code quality
- Test changes in development mode with `npm run dev`
- Build the application with `npm run build` to catch TypeScript and build errors
- Verify responsive design on multiple screen sizes
- Test database operations in a development environment first

## Resources

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/primitives/docs/overview/introduction)
