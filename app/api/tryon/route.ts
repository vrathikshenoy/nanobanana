import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
// History types might not be needed if we simplify the input structure
// import { HistoryItem, HistoryPart } from "@/libs/types";

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
  // Optionally throw an error or handle appropriately
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Define the model ID for Gemini 2.0 Flash experimental
const MODEL_ID = "gemini-2.0-flash-exp-image-generation";

// Removed FormattedHistoryItem interface as history handling is simplified

export async function POST(req: NextRequest) {
  let formData;
  try {
    // Parse FormData request instead of JSON
    formData = await req.formData();
  } catch (formError) {
    console.error("Error parsing FormData request body:", formError);
    return NextResponse.json(
      {
        error: "Invalid request body: Failed to parse FormData.",
        details: formError instanceof Error ? formError.message : String(formError),
      },
      { status: 400 } // Bad Request
    );
  }

  try {
    // Extract files and potentially a basic prompt text from FormData
    const userImageFile = formData.get("userImage") as File | null;
    const clothingImageFile = formData.get("clothingImage") as File | null;
    // const basicPrompt = formData.get("prompt") as string | null; // We'll construct the main prompt below

    if (!userImageFile || !clothingImageFile) {
      return NextResponse.json(
        { error: "Both userImage and clothingImage files are required" },
        { status: 400 }
      );
    }

    // Construct the detailed prompt for the AI
    const detailedPrompt = `{
      "prompt_version": "2.0", // Updated version
      "objective": "Generate a photorealistic virtual try-on image, seamlessly integrating a specified clothing item onto a person while rigidly preserving their facial identity, the clothing's exact appearance, and placing them in a completely new, distinct background.",
      "task": "High-Fidelity Virtual Try-On with Identity/Garment Preservation and Background Replacement", // Updated task name

      "inputs": {
        "person_image": {
          "description": "Source image containing the target person. Used *primarily* for identity (face, skin tone), pose, body shape, hair, and accessories. The original background will be DISCARDED.",
          "id": "input_1"
        },
        "garment_image": {
          "description": "Source image containing the target clothing item. May include a model, mannequin, or be flat-lay. Used *strictly* for the clothing's visual properties (color, style, texture, pattern).",
          "id": "input_2"
        },
        "background_preference": { // NEW Optional Input
          "description": "Optional textual description or style reference for the desired new background (e.g., 'neutral studio', 'outdoor park scene', 'blurred cityscape'). If unspecified, generate a plausible, non-distracting, photorealistic background.",
          "id": "input_3",
          "required": false
        }
      },

      "processing_steps": [
        "Isolate the clothing item from 'garment_image' (input_2), discarding any original model, mannequin, or background. Extract exact color, pattern, texture, and style information.",
        "Identify the person (face, body shape, skin tone), pose, hair, and accessories from 'person_image' (input_1).",
        "Segment the person from the original background in 'person_image'.",
        "Determine the desired new background based on 'background_preference' or generate a suitable default.",
        "Analyze lighting cues from 'person_image' to inform initial lighting on the subject, but adapt lighting for consistency with the *new* background." // Adjusted lighting focus
      ],

      "output_requirements": {
        "description": "Generate a single, high-resolution image where the person from 'person_image' appears to be naturally and realistically wearing the clothing item from 'garment_image', situated within a **completely new and different background**.", // Updated description
        "format": "Image (e.g., PNG, JPG)",
        "quality": "Photorealistic, free of obvious artifacts, blending issues, or inconsistencies between subject, garment, and the new background."
      },

      "core_constraints": {
        "identity_lock": {
          "priority": "ABSOLUTE CRITICAL", // Stronger priority term
          "instruction": "Maintain the **PERFECT** facial identity, features, skin tone, and expression of the person from 'person_image'. **ZERO alterations** to the face are permitted. Treat the head region (including hair) as immutable unless directly and logically occluded by the garment. DO NOT GUESS OR HALLUCINATE FACIAL FEATURES." // Explicitly added "DO NOT GUESS" and strengthened language
        },
        "garment_fidelity": {
          "priority": "ABSOLUTE CRITICAL", // Stronger priority term
          "instruction": "Preserve the **EXACT** color (hue, saturation, brightness), pattern, texture, material properties, and design details of the clothing item from 'garment_image'. **ZERO deviations** in style, color, or visual appearance are allowed. Render the garment precisely as depicted in input_2." // Strengthened language
        },
        "background_replacement": { // NEW Constraint (Replaces background_preservation)
          "priority": "CRITICAL",
          "instruction": "Generate a **COMPLETELY NEW and DIFFERENT** background that is distinct from the original background in 'person_image'. The new background should be photorealistic and contextually plausible for a person/fashion image unless otherwise specified by 'background_preference'. Ensure the person is seamlessly integrated into this new environment. **NO elements** from the original background should remain visible."
        },
        "pose_preservation": {
          "priority": "HIGH",
          "instruction": "Retain the **exact** body pose and positioning of the person from 'person_image'."
        },
        "realistic_integration": {
          "priority": "HIGH",
          "instruction": "Simulate physically plausible draping, folding, and fit of the garment onto the person's body according to their shape and pose. Ensure natural interaction with the body within the context of the *new* background." // Added context mention
        },
        "lighting_consistency": {
          "priority": "HIGH",
          "instruction": "Apply lighting, shadows, and highlights to the rendered garment AND the person that are **perfectly consistent** with the direction, intensity, and color temperature implied by the **NEW background**. Adjust subject lighting subtly if necessary to match the new scene, but prioritize maintaining a natural look consistent with the original subject's lighting where possible." // Adjusted for new background lighting dominance
        }
      },

      "additional_constraints": {
        "body_proportion_accuracy": "Scale the garment accurately to match the person's body proportions.",
        "occlusion_handling": "Render natural and correct occlusion where the garment covers parts of the body, hair, or existing accessories from 'person_image'. Preserve visible unique features (tattoos, scars) unless occluded.",
        "hair_and_accessory_integrity": "Maintain hair and non-clothing accessories (glasses, jewelry, hats) from 'person_image' unless logically occluded by the new garment. Integrate them seamlessly with the person and the new background.",
        "texture_and_detail_rendering": "Render fine details (e.g., embroidery, seams, buttons, lace, sheer fabric properties) from the garment with high fidelity.",
        "scene_coherence": "Ensure the person logically fits within the generated background environment (e.g., appropriate scale, perspective, interaction with ground plane if applicable)." // New constraint for background coherence
      },

      "edge_case_handling": {
        "tight_fitting_clothing": "Accurately depict fabric stretch and conformity to body contours.",
        "transparent_sheer_clothing": "Realistically render transparency, showing underlying skin tone or layers appropriately.",
        "complex_garment_geometry": "Handle unusual shapes, layers, or asymmetrical designs with correct draping.",
        "unusual_poses": "Ensure garment drape remains physically plausible even in non-standard or dynamic poses.",
        "garment_partially_out_of_frame": "Render the visible parts of the garment correctly; do not hallucinate missing sections.",
        "low_resolution_inputs": "Maximize detail preservation but prioritize realistic integration over inventing details not present in the inputs.",
        "mismatched_lighting_inputs": "Prioritize generating a coherent lighting environment based on the **NEW background**, adapting the garment and slightly adjusting the person's apparent lighting for a unified final image. Avoid harsh lighting clashes." // Updated for new background
      },

      "prohibitions": [ // Updated prohibitions
        "DO NOT alter the person's facial features, identity, expression, or skin tone.",
        "DO NOT modify the intrinsic color, pattern, texture, or style of the clothing item.",
        "DO NOT retain ANY part of the original background from 'person_image'.",
        "DO NOT change the person's pose.",
        "DO NOT introduce elements not present in the input images (person, garment) except for the generated background and necessary shadows/lighting adjustments for integration.",
        "DO NOT hallucinate or guess facial details; if obscured, maintain the integrity of visible parts based on identity lock.",
        "DO NOT generate a background that is stylistically jarring or contextually nonsensical without explicit instruction via 'background_preference'."
      ]
    }
  `;

    // --- Convert Files to Base64 ---
    const userImageBuffer = await userImageFile.arrayBuffer();
    const userImageBase64 = arrayBufferToBase64(userImageBuffer);
    const userImageMimeType = userImageFile.type || "image/jpeg"; // Default or derive from file

    const clothingImageBuffer = await clothingImageFile.arrayBuffer();
    const clothingImageBase64 = arrayBufferToBase64(clothingImageBuffer);
    const clothingImageMimeType = clothingImageFile.type || "image/png"; // Default or derive from file

    console.log(
      `User Image: ${userImageMimeType}, size: ${userImageBase64.length}`
    );
    console.log(
      `Clothing Image: ${clothingImageMimeType}, size: ${clothingImageBase64.length}`
    );


    let response;

    try {
      // --- Prepare Contents for Gemini API ---
      // Simplified structure: Prompt + User Image + Clothing Image
      const contents = [
        {
          role: "user",
          parts: [
            { text: detailedPrompt }, // Use the constructed detailed prompt
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


      // --- Generate the content ---
      response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: contents, // Use the new contents structure
        // Generation Config - adjust as needed
        config: {
          temperature: 0.6, // Slightly lower temp might be better for editing tasks
          topP: 0.95,
          topK: 40,
          // Ensure image modality is requested if the model supports it
          responseModalities: ["Text", "Image"],
        },
      });

      // Add this line to log the full API response for debugging
      console.log("Full Gemini API Response:", JSON.stringify(response, null, 2));

    } catch (error) {
      console.error("Error in Gemini API call (generateContent):", error);
      // Add specific error handling or re-throw as needed
      if (error instanceof Error) {
        throw new Error(`Failed during API call: ${error.message}`);
      }
      throw new Error("An unknown error occurred during the API call");
    }

    let textResponse = null;
    let imageData = null;
    let imageMimeType = "image/png"; // Default

    // Process the response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0]?.content?.parts;
      if (parts) {
        console.log("Number of parts in response:", parts.length);

        for (const part of parts) {
          if ("inlineData" in part && part.inlineData) {
            // Get the image data
            imageData = part.inlineData.data;
            imageMimeType = part.inlineData.mimeType || "image/png";
            if (imageData) {
              console.log(
                "Image data received, length:", imageData.length,
                "MIME type:", imageMimeType
              );
            }
          } else if ("text" in part && part.text) {
            // Store the text
            textResponse = part.text;
            console.log(
              "Text response received:",
              textResponse.substring(0, 100) + (textResponse.length > 100 ? "..." : "")
            );
          }
        }
      } else {
        console.log("No parts found in the response candidate.");
      }
    } else {
      console.log("No candidates found in the API response.");
      // Attempt to get potential error message from response if available
      const safetyFeedback = response?.promptFeedback?.blockReason;
      if (safetyFeedback) {
        console.error("Content generation blocked:", safetyFeedback);
        throw new Error(`Content generation failed due to safety settings: ${safetyFeedback}`);
      }
      const responseText = JSON.stringify(response, null, 2); // Log the full response for debugging
      console.error("Unexpected API response structure:", responseText);
      throw new Error("Received an unexpected or empty response from the API.");
    }


    // Return the base64 image and description as JSON
    return NextResponse.json({
      image: imageData ? `data:${imageMimeType};base64,${imageData}` : null,
      description: textResponse || "AI description not available.", // Provide default text
    });
  } catch (error) {
    console.error("Error processing virtual try-on request:", error);
    return NextResponse.json(
      {
        error: "Failed to process virtual try-on request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}