// supabase/functions/fattureincloud/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const body = await req.json()

    // Handle client list fetching with pagination
    if (body.action === 'fetch_clients') {
      const { companyId, accessToken, page = 1, perPage = 20, search = '' } = body

      // Build query parameters
      const params = new URLSearchParams({
        fieldset: 'basic',
        per_page: perPage.toString(),
        page: page.toString()
      })

      // Add search query if provided - use FattureInCloud SQL-like syntax
      const trimmedSearch = search?.trim() || ''
      if (trimmedSearch.length > 0) {
        // Escape single quotes in the search term to prevent SQL injection
        const escapedSearch = trimmedSearch.replace(/'/g, "''")
        // Use FattureInCloud's SQL-like query syntax: name contains 'search_term'
        const query = `name contains '${escapedSearch}'`
        params.append('q', query)
        console.log(`Fetching clients - Page: ${page}, PerPage: ${perPage}, Query: "${query}"`)
      } else {
        console.log(`Fetching clients - Page: ${page}, PerPage: ${perPage}, No search query`)
      }

      const response = await fetch(
        `https://api-v2.fattureincloud.it/c/${companyId}/entities/clients?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`FattureInCloud API error (${response.status}):`, errorText)
        return new Response(JSON.stringify({
          error: `FattureInCloud API error: ${response.status}`,
          details: errorText
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
          status: response.status
        })
      }

      const data = await response.json()

      // Validate the response has the expected structure
      if (!data.data) {
        console.error('Invalid response from FattureInCloud:', data)
        return new Response(JSON.stringify({
          error: 'Invalid response structure from FattureInCloud API'
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
          status: 500
        })
      }

      console.log(`Fetched page ${page}:`, {
        currentPage: data.current_page,
        lastPage: data.last_page,
        total: data.total,
        from: data.from,
        to: data.to,
        clientsCount: data.data?.length
      })

      // Return full response with pagination metadata
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 200
      })
    }

    // Handle client details fetching
    if (body.action === 'fetch_client_details') {
      const { companyId, clientId, accessToken } = body
      
      const response = await fetch(
        `https://api-v2.fattureincloud.it/c/${companyId}/entities/clients/${clientId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      const data = await response.json()
      
      return new Response(JSON.stringify(data), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: response.status
      })
    }

    // Handle contract upload (existing functionality)
    const { contract, partnerSettings, documentData } = body

    const response = await fetch(
      `https://api-v2.fattureincloud.it/c/${partnerSettings.fattureincloud_company_id}/issued_documents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${partnerSettings.fattureincloud_api_token}`
        },
        body: JSON.stringify(documentData)
      }
    )

    const result = await response.json()
    
    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: response.status
    })

  } catch (error) {
    console.error('Edge function error:', error.message, error.stack)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: 500
    })
  }
})