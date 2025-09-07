import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { OrganizationProvider } from "@/features/organization/lib/organization-context"
import { PageContextProvider } from "./page-context"


// Create a client
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60
        }
    }
})

export function Providers({ children }: { children: ReactNode }) {

    return (
        <QueryClientProvider client={queryClient}>
            <AuthQueryProvider>
                <OrganizationProvider>
                    <PageContextProvider>
                        {children}
                    </PageContextProvider>
                </OrganizationProvider>
            </AuthQueryProvider>
        </QueryClientProvider>
    )
}