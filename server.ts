import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK with telemetry user-agent
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. Calls to Gemini API will fail.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGeminiClient();

async function startServer() {
  const app = express();
  app.use(express.json());

  // API endpoint for multi-agent collaboration
  app.post('/api/agents/collaborate', async (req, res) => {
    try {
      const { prompt, selectedAgents } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        return res.status(400).json({ error: 'A valid project idea or prompt is required.' });
      }

      if (!selectedAgents || !Array.isArray(selectedAgents) || selectedAgents.length === 0) {
        return res.status(400).json({ error: 'At least one agent must be selected.' });
      }

      if (!ai) {
        return res.status(503).json({ 
          error: 'Gemini API is not configured. Please add GEMINI_API_KEY in Settings > Secrets.' 
        });
      }

      // Generate the dynamic system instruction based on selected agents
      const agentsListText = selectedAgents.map(a => `- **${a.name}** (${a.role}): ${a.description}`).join('\n');
      
      const systemInstruction = `You are a group of elite virtual expert agents collaborating in a brainstorm studio. 
Your goal is to fully design, refine, and create an actionable blueprint for the user's project idea.

The selected virtual experts in this session are:
${agentsListText}

You must simulate an elegant, collaborative, multi-turn conversation (minimum 3-4 replies total across agents) where the agents:
1. Brainstorm the core concept, discussing its value and feasibility.
2. Debate architectural and technical stack decisions.
3. Call out potential blind spots or challenges.
4. Synthesize their discussion into a final, highly structured project Blueprint.
5. Create a visual Mindmap tree representation of the architecture (with "nodes" and "links").
6. List high-priority actionable tasks (Action Items) assigned to the respective agents.

Each agent should speak in their distinct voice and persona:
- Creators should be optimistic, user-focused, and design-centric.
- Architects/Developers should be pragmatic, modular, security-conscious, and technical.
- Critics/Strategists should be analytical, risk-aware, and business-focused.

Ensure the dialogue text is highly engaging, constructive, and realistic. Make sure the mindmap nodes have a hierarchical tree structure starting with a single root node (e.g., id: "root", label: "Project Title", type: "root") branch nodes (e.g. "Tech Stack", "Core Features", "Next Steps"), and leaf nodes connected to those branches. Use unique string IDs for nodes and map links correctly.`;

      const promptMessage = `Collaborate and design the following project idea: "${prompt}". 
Simulate the brainstorm session, design the full architectural blueprint, draft the mindmap node tree, and set up action items.`;

      console.log(`[Gemini Agent Studio] Starting collaboration session for: "${prompt.substring(0, 40)}..."`);

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptMessage,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dialogue: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agentId: { type: Type.STRING, description: "The lower-case unique ID of the agent (e.g. strategist, creator, architect)" },
                    agentName: { type: Type.STRING, description: "Display name of the agent" },
                    agentRole: { type: Type.STRING, description: "The role of the agent" },
                    text: { type: Type.STRING, description: "What the agent says in this brainstorm turn. Support Markdown bullet points if needed." },
                  },
                  required: ["agentId", "agentName", "agentRole", "text"],
                },
              },
              blueprint: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "The finalized title of the project" },
                  summary: { type: Type.STRING, description: "A detailed 2-3 sentence executive summary of the synthesized design" },
                  techStack: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Key technologies recommended by the Architect agent (e.g., React, Node.js, PostgreSQL)"
                  },
                  features: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                      },
                      required: ["title", "description"],
                    },
                    description: "Key core features of the system"
                  },
                  phases: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "e.g., Phase 1: MVP Setup" },
                        description: { type: Type.STRING, description: "Core tasks in this phase" },
                      },
                      required: ["name", "description"],
                    },
                    description: "Implementation phases"
                  },
                  challenges: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Key challenges and risk mitigations highlighted by the Critic agent"
                  },
                },
                required: ["title", "summary", "techStack", "features", "phases", "challenges"],
              },
              mindmap: {
                type: Type.OBJECT,
                properties: {
                  nodes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        type: { type: Type.STRING, description: "One of: 'root', 'branch', 'leaf'" },
                      },
                      required: ["id", "label", "type"],
                    },
                  },
                  links: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        source: { type: Type.STRING, description: "Source node ID" },
                        target: { type: Type.STRING, description: "Target node ID" },
                      },
                      required: ["source", "target"],
                    },
                  },
                },
                required: ["nodes", "links"],
              },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    task: { type: Type.STRING, description: "The specific task to complete" },
                    owner: { type: Type.STRING, description: "The role/agent name who owns this task (e.g. Architect, Critic, Creator)" },
                    priority: { type: Type.STRING, description: "One of: 'high', 'medium', 'low'" },
                  },
                  required: ["id", "task", "owner", "priority"],
                },
              },
            },
            required: ["dialogue", "blueprint", "mindmap", "actionItems"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Received empty response from Gemini API");
      }

      const sessionData = JSON.parse(responseText);
      res.json(sessionData);

    } catch (error: any) {
      console.error('[Gemini Agent Studio] Error during collaboration:', error);
      res.status(500).json({ 
        error: error.message || 'An internal error occurred during the brainstorm session. Please try again.' 
      });
    }
  });

  // Serve static assets or compile with Vite
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    console.log('[Gemini Agent Studio] Running in development mode with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Gemini Agent Studio] Server is listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('[Gemini Agent Studio] Failed to start server:', err);
});
