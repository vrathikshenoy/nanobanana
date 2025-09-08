import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Initialize the Google Gen AI client with your API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY environment variable.");
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Define the model ID for Gemini 2.5 Flash Image Preview
const MODEL_ID = "gemini-2.5-flash-image-preview";

export async function POST(req: NextRequest) {
  let formData;
  try {
    formData = await req.formData();
  } catch (formError) {
    console.error("Error parsing FormData request body:", formError);
    return NextResponse.json(
      {
        error: "Invalid request body: Failed to parse FormData.",
        details: formError instanceof Error
          ? formError.message
          : String(formError),
      },
      { status: 400 },
    );
  }

  try {
    // Extract files and optional parameters from FormData
    const userImageFile = formData.get("userImage") as File | null;
    const clothingImageFile = formData.get("clothingImage") as File | null;
    const backgroundPreference = formData.get("backgroundPreference") as
      | string
      | null;
    const useDetailedPrompt = formData.get("useDetailedPrompt") as
      | string
      | null;

    if (!userImageFile || !clothingImageFile) {
      return NextResponse.json(
        { error: "Both userImage and clothingImage files are required" },
        { status: 400 },
      );
    }

    // Improved Natural Language Prompts (following Nano Banana best practices)
    const detailedPrompt = `
Transform the person in the first uploaded image to naturally wear the clothing item from the second uploaded image, while placing them in a completely new photorealistic background.

**Primary Action**: Apply the exact garment from the clothing reference image onto the person while preserving their complete facial identity and replacing their background entirely.

**Identity Preservation Requirements**:
Maintain the person's exact facial features, skin tone, expression, and hair without any alterations. Keep their precise body pose and proportions unchanged. Preserve any visible accessories like jewelry or glasses that don't conflict with the new garment. The person's face must remain completely identical to the original image.

**Garment Application Requirements**:
Use the clothing reference image to extract and apply the exact colors, patterns, textures, and design details of the garment. Ensure the clothing fits naturally on the person's body with realistic draping and fabric behavior that follows physics. Scale the clothing appropriately to match the person's body size and proportions. Render fine details like buttons, seams, embroidery, and fabric texture with high fidelity.

**Background Replacement Requirements**:
Generate a completely new, photorealistic background that's entirely different from the original person image. ${backgroundPreference
        ? `Create a background that matches this preference: ${backgroundPreference}`
        : "Create a neutral, professional studio setting with soft lighting"
      }. Ensure the lighting and shadows on both the person and garment match the new environment perfectly. Make the person appear naturally integrated into the new scene with proper perspective and scale.

**Technical Quality Standards**:
Produce a single high-resolution, photorealistic image with seamless blending and no visible artifacts or inconsistencies. Handle transparent or sheer fabrics realistically, showing appropriate skin tone underneath. For tight-fitting clothes, show natural fabric stretch and body contours. Maintain proper occlusion where the garment covers the person's original clothing. Ensure all elements look professionally photographed together.

**Critical Instructions**:
The first uploaded image provides the person's identity, pose, and body shape. The second uploaded image provides the exact clothing appearance and details. Discard all background elements from both reference images. Generate a result that looks like a real professional photograph of this specific person wearing this exact clothing item in the new environment.
    `;

    const concisePrompt = `
Apply the exact clothing from the second uploaded image onto the person in the first uploaded image. Place them in a ${backgroundPreference || "neutral studio"
      } background.

Preserve the person's facial identity, expression, and pose exactly as shown. Use the garment's precise colors, patterns, and textures. Ensure realistic fabric draping and natural lighting that matches the new background.

Generate a photorealistic result with seamless integration and no visible artifacts. The output should look like a professional photograph.
    `;

    // Choose prompt based on parameter or default to detailed
    const selectedPrompt = useDetailedPrompt === "false"
      ? concisePrompt
      : detailedPrompt;

    // Convert Files to Base64
    const userImageBuffer = await userImageFile.arrayBuffer();
    const userImageBase64 = arrayBufferToBase64(userImageBuffer);
    const userImageMimeType = userImageFile.type || "image/jpeg";

    const clothingImageBuffer = await clothingImageFile.arrayBuffer();
    const clothingImageBase64 = arrayBufferToBase64(clothingImageBuffer);
    const clothingImageMimeType = clothingImageFile.type || "image/png";

    console.log(
      `User Image: ${userImageMimeType}, size: ${userImageBase64.length}`,
    );
    console.log(
      `Clothing Image: ${clothingImageMimeType}, size: ${clothingImageBase64.length}`,
    );
    console.log(
      `Using ${useDetailedPrompt === "false" ? "concise" : "detailed"} prompt`,
    );

    let response;

    try {
      // Prepare Contents for Gemini API with improved structure
      const contents = [
        {
          role: "user",
          parts: [
            { text: selectedPrompt },
            {
              inlineData: {
                mimeType: userImageMimeType,
                data: userImageBase64,
              },
            },
            {
              inlineData: {
                mimeType: clothingImageMimeType,
                data: clothingImageBase64,
              },
            },
          ],
        },
      ];

      // Generate the content with optimized configuration
      response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: contents,
        config: {
          temperature: 0.2, // Much lower for more consistent, conservative results
          topP: 0.8, // More focused generation
          topK: 20, // Reduced for better consistency
          maxOutputTokens: 8192,
          responseModalities: ["Text", "Image"],
          // Add safety settings for more conservative generation
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        },
      });

      console.log(
        "Gemini API Response Status:",
        response.candidates?.[0]?.finishReason || "Unknown",
      );
    } catch (error) {
      console.error("Error in Gemini API call:", error);

      // Enhanced error handling
      if (error instanceof Error) {
        if (error.message.includes("quota")) {
          throw new Error("API quota exceeded. Please try again later.");
        } else if (error.message.includes("safety")) {
          throw new Error(
            "Content was blocked by safety filters. Please try different images.",
          );
        } else {
          throw new Error(`API call failed: ${error.message}`);
        }
      }
      throw new Error("An unknown error occurred during the API call");
    }

    let textResponse = null;
    let imageData = null;
    let imageMimeType = "image/png";

    // Enhanced response processing
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];

      // Check for safety or other issues
      if (candidate.finishReason === "SAFETY") {
        console.error("Content generation blocked by safety filters");
        return NextResponse.json(
          {
            error: "Content generation was blocked by safety filters",
            details:
              "Please try with different images that comply with content policies",
          },
          { status: 400 },
        );
      }

      const parts = candidate?.content?.parts;
      if (parts) {
        console.log("Processing response parts:", parts.length);

        for (const part of parts) {
          if ("inlineData" in part && part.inlineData) {
            imageData = part.inlineData.data;
            imageMimeType = part.inlineData.mimeType || "image/png";
            if (imageData) {
              console.log(
                "Image generated successfully, size:",
                imageData.length,
                "MIME type:",
                imageMimeType,
              );
            }
          } else if ("text" in part && part.text) {
            textResponse = part.text;
            console.log(
              "Text response:",
              textResponse.substring(0, 150) + "...",
            );
          }
        }
      } else {
        console.error("No parts found in the response candidate");
      }
    } else {
      console.error("No candidates in API response");

      // Check for prompt feedback
      const promptFeedback = response?.promptFeedback;
      if (promptFeedback?.blockReason) {
        console.error("Prompt blocked:", promptFeedback.blockReason);
        return NextResponse.json(
          {
            error: "Request was blocked",
            details: `Reason: ${promptFeedback.blockReason}`,
            suggestion:
              "Please try with different images or modify your request",
          },
          { status: 400 },
        );
      }

      throw new Error("No valid response generated from the API");
    }

    // Validate that we received an image
    if (!imageData) {
      console.error("No image data received from API");
      return NextResponse.json(
        {
          error: "No image was generated",
          details: "The AI model did not produce an image output",
          textResponse: textResponse || null,
        },
        { status: 500 },
      );
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      image: `data:${imageMimeType};base64,${imageData}`,
      description: textResponse || "Virtual try-on completed successfully",
      metadata: {
        promptType: useDetailedPrompt === "false" ? "concise" : "detailed",
        backgroundPreference: backgroundPreference || "default studio",
        userImageType: userImageMimeType,
        clothingImageType: clothingImageMimeType,
      },
    });
  } catch (error) {
    console.error("Error processing virtual try-on request:", error);

    // Enhanced error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isClientError = errorMessage.includes("quota") ||
      errorMessage.includes("safety") ||
      errorMessage.includes("blocked");

    return NextResponse.json(
      {
        error: "Failed to process virtual try-on request",
        details: errorMessage,
        timestamp: new Date().toISOString(),
        suggestion: isClientError
          ? "Please check your request and try again"
          : "Please try again later or contact support if the issue persists",
      },
      { status: isClientError ? 400 : 500 },
    );
  }
}
