#!/bin/bash

# Production Deployment Script for URL Summarizer
# Make sure you have supabase CLI and vercel CLI installed

echo "🚀 Starting production deployment..."

# Check if we're in the right directory
if [ ! -f "deploy-schema.sql" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📊 Deploying database schema..."
echo "Please run the SQL in deploy-schema.sql in your production Supabase dashboard"
echo "Press Enter when done..."
read

echo "🔧 Deploying Edge Functions..."
# Link to production (you'll need to enter your project ref)
echo "Please run: supabase link --project-ref YOUR_PRODUCTION_PROJECT_ID"
echo "Press Enter when linked..."
read

# Set OpenAI API key
echo "Setting OpenAI API key..."
echo "Please run: supabase secrets set OPENAI_API_KEY=your_key_here"
echo "Press Enter when done..."
read

# Deploy functions
echo "Deploying edge functions..."
supabase functions deploy summerize_url
supabase functions deploy process-url

echo "📱 Preparing React app for deployment..."
cd url-summarizer

# Install dependencies if needed
npm install

# Build the project
npm run build

echo "🌐 Ready for Vercel deployment!"
echo "Run: vercel --prod"
echo "Or push to GitHub and import in Vercel dashboard"

echo "✅ Deployment preparation complete!"
echo "Don't forget to:"
echo "1. Update .env.production with your actual Supabase credentials"
echo "2. Set environment variables in Vercel dashboard"
echo "3. Test the deployed application"