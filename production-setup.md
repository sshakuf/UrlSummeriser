# Production Deployment Guide

## 1. Deploy Database Schema

### In your Production Supabase Dashboard:
1. Go to your production Supabase project
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `deploy-schema.sql`
4. Click **Run** to create all tables and insert sample prompts

## 2. Deploy Edge Functions

### Link to Production Project:
```bash
# In your project root directory
cd /Users/sshakuf/Development/UrlSummerizer

# Link to your production project
supabase link --project-ref YOUR_PRODUCTION_PROJECT_ID

# You can find your project ID in your Supabase dashboard URL
# https://supabase.com/dashboard/project/YOUR_PROJECT_ID
```

### Set Environment Variables:
```bash
# Set your OpenAI API key for production
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

### Deploy Functions:
```bash
# Deploy both edge functions to production
supabase functions deploy summerize_url
supabase functions deploy process-url

# Verify deployment
supabase functions list
```

## 3. Deploy React App to Vercel

### Prepare Environment Variables:
Create a `.env.production` file in your `url-summarizer` directory:

```env
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_production_anon_key
```

### Vercel Deployment Options:

#### Option A: Vercel CLI (Recommended)
```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Navigate to your React app directory
cd url-summarizer

# Deploy to Vercel
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No (for first deployment)
# - Project name? url-summarizer (or your preferred name)
# - Directory? ./
# - Override settings? No

# For production deployment:
vercel --prod
```

#### Option B: GitHub + Vercel (Alternative)
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Set build settings:
   - Framework: Create React App
   - Root directory: `url-summarizer`
   - Build command: `npm run build`
   - Output directory: `build`

### Configure Environment Variables in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add these variables:
   - `REACT_APP_SUPABASE_URL`: Your production Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY`: Your production anon key

## 4. Get Production URLs and Keys

### From Supabase Dashboard:
1. Go to **Settings** > **API**
2. Copy your:
   - Project URL
   - Anon/Public key
   - Service Role key (for edge functions)

### Test Your Deployment:
1. Visit your Vercel URL
2. Test adding a URL with a prompt
3. Check if AI processing works
4. Verify prompts management page

## 5. Update CORS (if needed)

If you encounter CORS issues, update your edge functions to include your Vercel domain:

```typescript
// In both edge functions, update CORS headers:
'Access-Control-Allow-Origin': 'https://your-vercel-app.vercel.app'
// Or keep '*' for all origins (less secure but easier)
```

## 6. Monitor and Debug

### Check Logs:
- **Supabase**: Dashboard > Logs > Edge Functions
- **Vercel**: Dashboard > Functions > View Function Logs
- **Browser**: Developer Tools > Console

### Common Issues:
1. **Environment variables not loading**: Redeploy after setting env vars
2. **CORS errors**: Update Access-Control-Allow-Origin headers
3. **OpenAI API errors**: Verify API key is set correctly in Supabase secrets
4. **Database connection issues**: Check service role key configuration