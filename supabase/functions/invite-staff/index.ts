import { createClient } from 'npm:@supabase/supabase-js@2';
const origin = Deno.env.get('CAMPIFY_SITE_URL') || 'https://db-campify.vercel.app';
const allowedOrigins = new Set([origin, 'https://db-campify.vercel.app', 'https://db-campify-joelihm1-5830.vercel.app']);
Deno.serve(async req => {
  const requestOrigin = req.headers.get('Origin');
  const headers = { 'Access-Control-Allow-Origin': requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json', 'Vary':'Origin' };
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  if(!origin)return respond({error:'Invitation redirect is not configured'},503);
  const authorization=req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return respond({error:'Sign in required'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(authorization.slice(7));
  if(authError||!user)return respond({error:'Sign in required'},401);
  try {
    const {email,program_id}=await req.json();
    if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof program_id!=='string')return respond({error:'Enter a valid staff email'},400);
    const {data:permission,error}=await admin.from('program_admins').select('user_id').eq('program_id',program_id).eq('user_id',user.id).maybeSingle();
    if(error||!permission)return respond({error:'Program administrator access required'},403);
    const redirect=new URL(origin);redirect.search='?account=setup';
    const {data,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(),{redirectTo:redirect.toString()});
    if(inviteError)return respond({error:inviteError.message},400);
    const {error:memberError}=await admin.from('program_members').upsert({program_id,user_id:data.user.id});
    if(memberError)return respond({error:'Email sent, but program access could not be assigned. Contact your administrator before retrying.'},500);
    return respond({sent:true});
  }catch{return respond({error:'Unable to process invitation'},400);}
});
