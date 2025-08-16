// Edge Function to process URL: fetch from DB, scrape content, and send to ChatGPT
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Process URL Function loaded!")

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
    const { url_id, prompt_id } = await req.json()
    
    if (!url_id) {
      return new Response(
        JSON.stringify({ error: "url_id is required" }),
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

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log(`Processing URL ID: ${url_id} with Prompt ID: ${prompt_id}`)

    // 1. Fetch URL from database
    const { data: urlData, error: fetchError } = await supabase
      .from('urls')
      .select('*')
      .eq('id', url_id)
      .single()

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch URL from database", 
          details: fetchError.message 
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

    // 2. Fetch prompt from database
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
          details: promptError.message 
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

    if (!urlData) {
      return new Response(
        JSON.stringify({ error: "URL not found" }),
        { 
          status: 404, 
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log(`Found URL: ${urlData.url}`)
    console.log(`Current caption: ${urlData.caption}`)
    console.log(`Using prompt: ${promptData.prompt_name}`)

    // 3. Scrape website content
    console.log(`Scraping content from: ${urlData.url}`)
    
    let scrapedText = ""
    try {
      const response = await fetch(urlData.url, {
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
          details: scrapeError.message 
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

    // 4. Send to ChatGPT
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.log('OpenAI API key is missing')
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
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

    try {
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
              content: `${finalPrompt}\n\nWebsite URL: ${urlData.url}\nContent: ${scrapedText}`
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

      // 5. Save to url_summery table
      const { data: summeryData, error: summeryError } = await supabase
        .from('url_summery')
        .insert({
          url_id: url_id,
          prompt_id: prompt_id,
          scraped_data: scrapedText,
          ai_response: aiResponse
        })
        .select()
        .single()

      if (summeryError) {
        console.error('Failed to save to url_summery:', summeryError)
        // Don't fail the request, just log the error
      } else {
        console.log('Saved to url_summery table with ID:', summeryData.id)
      }

      // Return the complete response
      const responseData = {
        success: true,
        url_id: url_id,
        url: urlData.url,
        original_caption: urlData.caption,
        scraped_text_length: scrapedText.length,
        ai_response: aiResponse,
        prompt_used: finalPrompt,
        prompt_name: promptData.prompt_name,
        model: 'gpt-3.5-turbo',
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
      console.error('ChatGPT API error:', aiError)
      return new Response(
        JSON.stringify({ 
          error: "Failed to get AI response", 
          details: aiError.message 
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
    console.error('General error:', error)
    return new Response(
      JSON.stringify({ error: "Invalid request body or internal error", details: error.message }),
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

  1. Set your OpenAI API key as environment variable:
     export OPENAI_API_KEY=your_openai_api_key_here

  2. Run `supabase functions serve process-url --no-verify-jwt --env-file .env`

  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-url' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"url_id": 1, "prompt": "Summarize this webpage in 2-3 sentences"}'

*/
