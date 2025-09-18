import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Alert, AlertDescription } from '@/ui/alert'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { createServerFn } from '@tanstack/react-start'
import { superadminMiddleware } from '@/features/admin/lib/superadmin-middleware'
import { db } from '@/lib/db/db'
import { simproCompanies, organization } from '@/database/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { testSimproConnectionForOrganization } from '@/lib/simpro/simpro.server'

// Server functions for admin operations
const getSimproConfigurations = createServerFn({ method: 'GET' })
  .middleware([superadminMiddleware])
  .handler(async () => {
    // Get all organizations with their Simpro configurations
    const orgs = await db
      .select({
        id: organization.id,
        name: organization.name,
        providerType: organization.providerType,
      })
      .from(organization)
      .where(eq(organization.providerType, 'simpro'))

    const configs = []
    for (const org of orgs) {
      const simproConfig = await db
        .select()
        .from(simproCompanies)
        .where(eq(simproCompanies.organizationId, org.id))
        .limit(1)

      configs.push({
        organizationId: org.id,
        organizationName: org.name,
        config: simproConfig[0] || null,
      })
    }

    return configs
  })

const updateSimproConfiguration = createServerFn({ method: 'POST' })
  .middleware([superadminMiddleware])
  .handler(async ({ data }: { data: {
    organizationId: string
    accessToken: string
    buildName: string
    domain: string
    companyId?: string
  }}) => {
    const { organizationId, accessToken, buildName, domain, companyId = '0' } = data

    // Check if configuration exists
    const existing = await db
      .select()
      .from(simproCompanies)
      .where(eq(simproCompanies.organizationId, organizationId))
      .limit(1)

    if (existing.length > 0) {
      // Update existing
      await db
        .update(simproCompanies)
        .set({
          accessToken,
          buildName,
          domain,
          companyId,
          updatedAt: new Date(),
        })
        .where(eq(simproCompanies.organizationId, organizationId))
    } else {
      // Create new
      await db.insert(simproCompanies).values({
        id: nanoid(),
        organizationId,
        accessToken,
        buildName,
        domain,
        companyId,
      })
    }

    return { success: true }
  })

const testSimproConnection = createServerFn({ method: 'POST' })
  .middleware([superadminMiddleware])
  .handler(async ({ data }: { data: { organizationId: string }}) => {
    const success = await testSimproConnectionForOrganization(data.organizationId)
    return { success }
  })

export const Route = createFileRoute('/_all-pages/admin/simpro-config')({
  component: SimproConfigPage,
})

function SimproConfigPage() {
  const queryClient = useQueryClient()
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    accessToken: '',
    buildName: '',
    domain: 'simprosuite.com',
    companyId: '0',
  })

  const { data: configurations, isLoading } = useQuery({
    queryKey: ['simpro-configurations'],
    queryFn: () => getSimproConfigurations(),
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData & { organizationId: string }) => 
      updateSimproConfiguration({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simpro-configurations'] })
      setSelectedOrg(null)
      setFormData({
        accessToken: '',
        buildName: '',
        domain: 'simprosuite.com',
        companyId: '0',
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: (organizationId: string) => 
      testSimproConnection({ data: { organizationId } }),
  })

  const handleEdit = (orgId: string, config: any) => {
    setSelectedOrg(orgId)
    if (config) {
      setFormData({
        accessToken: config.accessToken,
        buildName: config.buildName,
        domain: config.domain,
        companyId: config.companyId,
      })
    } else {
      // New configuration
      setFormData({
        accessToken: '',
        buildName: '',
        domain: 'simprosuite.com',
        companyId: '0',
      })
    }
  }

  const handleSave = () => {
    if (selectedOrg) {
      updateMutation.mutate({
        organizationId: selectedOrg,
        ...formData,
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Simpro Configuration</CardTitle>
          <CardDescription>
            Manage Simpro API access tokens for organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {configurations?.map((config) => (
              <Card key={config.organizationId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {config.organizationName}
                      </CardTitle>
                      {config.config && (
                        <CardDescription>
                          {config.config.buildName}.{config.config.domain}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {config.config && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testMutation.mutate(config.organizationId)}
                          disabled={testMutation.isPending}
                        >
                          {testMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Test Connection'
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(config.organizationId, config.config)}
                      >
                        {config.config ? 'Edit' : 'Configure'}
                      </Button>
                    </div>
                  </div>
                  {testMutation.data && testMutation.variables === config.organizationId && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {(testMutation.data as any)?.success ? (
                          <span className="text-success">Connection successful!</span>
                        ) : (
                          <span className="text-destructive">Connection failed. Check token and configuration.</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardHeader>
                {selectedOrg === config.organizationId && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="accessToken">Access Token</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        value={formData.accessToken}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, accessToken: e.target.value })}
                        placeholder="Enter permanent access token"
                      />
                    </div>
                    <div>
                      <Label htmlFor="buildName">Build Name</Label>
                      <Input
                        id="buildName"
                        value={formData.buildName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, buildName: e.target.value })}
                        placeholder="e.g., joeyjob"
                      />
                    </div>
                    <div>
                      <Label htmlFor="domain">Domain</Label>
                      <select
                        id="domain"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formData.domain}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, domain: e.target.value })}
                      >
                        <option value="simprosuite.com">simprosuite.com</option>
                        <option value="simprocloud.com">simprocloud.com</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="companyId">Company ID</Label>
                      <Input
                        id="companyId"
                        value={formData.companyId}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, companyId: e.target.value })}
                        placeholder="Default: 0"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Save Configuration
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedOrg(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}