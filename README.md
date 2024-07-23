# Braindump bot
This bot is used to automate question generation for the [Braindump](https://warpcast.com/~/channel/braindump) channel on farcaster. Every tuesday, thursday and saturday it will generate a question.

## Resources
prompting: 
- It uses the [node js open ai library](https://github.com/openai/openai-node) for prompting
- [Neynar](https://neynar.com/) for cast posting (as well as collecting initial questions as a baseline)
- [Supabase](https://supabase.com/) for postgresdb + image handling
- deployed using [Railway](https://railway.app?referralCode=aKwJhG)




## Start
node index.js
