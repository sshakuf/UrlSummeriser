// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { url, prompt_id } = await req.json()
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    if (!prompt_id) {
      return new Response(
        JSON.stringify({ error: "prompt_id is required" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // First, insert the URL into the database
    const caption = `URL added at ${new Date().toISOString()}`
    
    const { data: insertData, error: insertError } = await supabase
      .from('urls')
      .insert({
        url: url,
        caption: caption
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return new Response(
        JSON.stringify({ 
          error: "Failed to save URL to database", 
          details: insertError.message,
          code: insertError.code,
          hint: insertError.hint 
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log(`URL inserted with ID: ${insertData.id}, now processing...`)

    // Now automatically process the URL with AI
    try {
      // Fetch prompt from database
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', prompt_id)
        .single()

      if (promptError) {
        console.error('Prompt fetch error:', promptError)
        return new Response(
          JSON.stringify({ 
            error: "Failed to fetch prompt from database", 
            details: promptError.message,
            url_id: insertData.id // Still return the URL ID so user knows it was saved
          }),
          { 
            status: 404, 
            headers: { 
              "Content-Type": "application/json",
              'Access-Control-Allow-Origin': '*',
            } 
          }
        )
      }

      // Scrape website content
      console.log(`Scraping content from: ${url}`)
      
      let scrapedText = ""
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; UrlSummarizerBot/1.0)'
          }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const html = await response.text()
        
        // Simple text extraction - remove HTML tags and get text content
        scrapedText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove style tags
          .replace(/<[^>]*>/g, '')                          // Remove HTML tags
          .replace(/\s+/g, ' ')                             // Normalize whitespace
          .trim()
          .substring(0, 8000) // Limit text to avoid token limits
          
        console.log(`Scraped text length: ${scrapedText.length} characters`)
        
      } catch (scrapeError) {
        console.error('Scraping error:', scrapeError)
        return new Response(
          JSON.stringify({ 
            error: "Failed to scrape URL content", 
            details: scrapeError.message,
            url_id: insertData.id // Still return the URL ID
          }),
          { 
            status: 500, 
            headers: { 
              "Content-Type": "application/json",
              'Access-Control-Allow-Origin': '*',
            } 
          }
        )
      }

      // Send to ChatGPT
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openaiApiKey) {
        console.log('OpenAI API key is missing')
        return new Response(
          JSON.stringify({ 
            error: "OpenAI API key not configured",
            url_id: insertData.id // Still return the URL ID
          }),
          { 
            status: 500, 
            headers: { 
              "Content-Type": "application/json",
              'Access-Control-Allow-Origin': '*',
            } 
          }
        )
      }

      const finalPrompt = promptData.prompt

      console.log(`Sending to ChatGPT with prompt: ${finalPrompt.substring(0, 100)}...`)

      const chatGptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: `${finalPrompt}\n\nWebsite URL: ${url}\nContent: ${scrapedText}`
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      })

      if (!chatGptResponse.ok) {
        const errorData = await chatGptResponse.text()
        throw new Error(`ChatGPT API error: ${chatGptResponse.status} - ${errorData}`)
      }

      const chatGptData = await chatGptResponse.json()
      const aiResponse = chatGptData.choices[0]?.message?.content || "No response generated"
      
      console.log('ChatGPT Response:')
      console.log('================')
      console.log(aiResponse)
      console.log('================')

      // Save to url_summery table
      const { data: summeryData, error: summeryError } = await supabase
        .from('url_summery')
        .insert({
          url_id: insertData.id,
          prompt_id: prompt_id,
          scraped_data: scrapedText,
          ai_response: aiResponse
        })
        .select()
        .single()

      if (summeryError) {
        console.error('Failed to save to url_summery:', summeryError)
      } else {
        console.log('Saved to url_summery table with ID:', summeryData.id)
      }

      // Return the complete response with AI analysis
      const responseData = {
        success: true,
        url_id: insertData.id,
        url: insertData.url,
        summary: aiResponse, // This is the AI-generated summary
        prompt_used: promptData.prompt_name,
        created_at: insertData.created_at,
        processed: true,
        summery_id: summeryData?.id || null
      }

      return new Response(
        JSON.stringify(responseData),
        { 
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )

    } catch (aiError) {
      console.error('AI processing error:', aiError)
      return new Response(
        JSON.stringify({ 
          error: "URL saved but AI processing failed", 
          details: aiError.message,
          url_id: insertData.id, // Still return the URL ID
          url: insertData.url,
          created_at: insertData.created_at,
          processed: false
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { 
        status: 400, 
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/summerize_url' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
