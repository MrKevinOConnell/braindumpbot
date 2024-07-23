// Import the OpenAI package
const { OpenAI } = require("openai");
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
const dotenv = require("dotenv");
dotenv.config();
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

//NOTE: I used this to initially extract posts to use as examples for the AI
// async function extractPosts() {
//   try {
//     const cast = await client.fetchFeed(FeedType.Filter, {
//       filterType: FilterType.ChannelId,
//       fid: 4564,
//       fids: [4564],
//       channelId: "braindump",
//     });
//     // Get the list of posts from the API
//     const posts = cast.casts.map((cast) => {
//       console.log(cast);
//       return {
//         fid: cast.author.fid,
//         hash: cast.hash,
//         likes: cast.reactions.likes_count,
//         recasts: cast.reactions.recasts_count,
//         replies: cast.replies.count,
//         created_at: cast.timestamp,
//         prompt: cast.text,
//       };
//     });
//     //add to supabase
//     const { data, error } = await supabase.from("questions").insert(posts);
//     if (error) {
//       console.error("Error inserting posts:", error);
//     } else {
//       console.log("Posts inserted successfully:", data);
//     }
//   } catch (error) {
//     console.error("Error extracting posts:", error);
//   }
// }

async function generate_and_upload_image(text) {
  try {
    const image_completion = await openai.images.generate({
      prompt: `Generate an inspiring photo based off the following question: ${text}`,
      model: "dall-e-3",
      size: "1024x1024",
      response_format: "b64_json",
    });

    const image_base64 = image_completion.data[0].b64_json;
    const buffer = Buffer.from(image_base64, "base64");

    const filename = `image-${Date.now()}.png`;

    // Upload the image to Supabase
    const { data, error } = await supabase.storage
      .from("images")
      .upload(filename, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
    const image_url = `${process.env.SUPABASE_URL}/storage/v1/object/public/images/${data.path}`;

    return image_url;
  } catch (error) {
    console.log("Error generating or uploading image:", error);
  }
}

async function generate_prompt() {
  try {
    // Fetch prompts from the questions table
    const { data: questions, error } = await supabase
      .from("questions")
      .select("prompt");

    if (error) {
      throw error;
    }

    const examples = questions.map(
      (q, index) => `${index + 1}). ${q.prompt.replace(/ /g, "\n")}\n`
    );

    const system_prompt = {
      role: "system",
      content: `You are an AI designed to generate a thought-provoking 1023 character question of the day for users in the style of the examples.
    
    Your questions should be written in the style of the examples given. Take your time.
    
    Please ensure that there are new lines after the "question of the day" statement and after every thought in the question. 
    
    For example, structure the response like this:
    
    "Question of the day:
    
    [First thought of the question]
    
    [Second thought of the question]
    
    [Third thought of the question]"
    
    Here are the examples to write in the style of:
    ${examples.join(`\n`)}`,
    };

    // Generate chat completion
    const chat_completion = await openai.chat.completions.create({
      messages: [system_prompt],
      model: "gpt-4o-mini",
      max_tokens: 180,
      temperature: 0.6,
    });

    const text = chat_completion.choices[0].message.content;

    const url = await generate_and_upload_image(text);
    if (!url) {
      throw new Error("Error generating or uploading image");
    }

    const post = await client.publishCast(process.env.NEYNAR_SIGNER, text, {
      channelId: "braindump",
      embeds: [{ url }],
    });
    return post;
  } catch (error) {
    console.error("Error generating prompt:", error);
    return null;
  }
}
// Example usage
(async () => {
  const generatedText = await generate_prompt();
  if (generatedText) {
    //add row to supabase
    const response = await supabase.from("questions").insert([
      {
        fid: generatedText.author.fid,
        hash: generatedText.hash,
        likes: 0,
        recasts: 0,
        replies: 0,
        created_at: new Date().toISOString(),
        prompt: generatedText.text,
      },
    ]);
    if (!response || response.error) {
      console.error("Error inserting post:", error);
    } else {
      console.log("Post inserted successfully:");
    }
  }
})();
