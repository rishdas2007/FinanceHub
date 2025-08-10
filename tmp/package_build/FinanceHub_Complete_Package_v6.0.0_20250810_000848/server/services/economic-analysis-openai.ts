import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

interface AnalysisInstructions {
  analysis_instructions: string[];
  contextual_data_schema: {
    metric: string;
    category: string;
    statistics: {
      mean: string;
      median: string;
      std: string;
      min: string;
      max: string;
      start_value: string;
      end_value: string;
      period_start_date: string;
      period_end_date: string;
    };
    trend: string;
    data_points_12_months: string;
  };
}

export class EconomicAnalysisOpenAIService {
  private analysisInstructions: AnalysisInstructions = {
    "analysis_instructions": [
      "Review the provided statistical insights for each economic metric across all categories.",
      "For each metric, analyze its 'trend' (increasing, decreasing, stable) over the latest 12-month period.",
      "Examine the 'statistics' (mean, median, std, min, max, start_value, end_value) to identify any significant deviations or anomalies. For instance, a high standard deviation might indicate volatility, or a sudden change from 'start_value' to 'end_value' could highlight a sharp shift in trend.",
      "Synthesize the trends and anomalies from all categories (Consumer Spending, Employment, Housing, Manufacturing, Inflation, Growth, Monetary Policy, Sentiment).",
      "Provide a concise summary of the overall economic health based on these combined trends. For example, consistent increasing trends in Employment and Consumer Spending, coupled with stable Inflation and Growth, would generally suggest a healthy and expanding economy. Conversely, decreasing trends in key areas or rising inflation without corresponding growth could indicate economic challenges."
    ],
    "contextual_data_schema": {
      "metric": "Name of the economic indicator",
      "category": "Economic category (e.g., Consumer Spending, Employment)",
      "statistics": {
        "mean": "Average value over the trailing 12 months",
        "median": "Middle value over the trailing 12 months",
        "std": "Standard deviation over the trailing 12 months, indicating data dispersion",
        "min": "Minimum value observed over the trailing 12 months",
        "max": "Maximum value observed over the trailing 12 months",
        "start_value": "Value at the beginning of the trailing 12-month period",
        "end_value": "Value at the end of the trailing 12-month period",
        "period_start_date": "The earliest date included in the 12-month trailing period (YYYY-MM-DD)",
        "period_end_date": "The latest date included in the 12-month trailing period (YYYY-MM-DD)"
      },
      "trend": "Identified trend (increasing, decreasing, stable, or not enough data) over the trailing 12 months, derived from comparing start and end values.",
      "data_points_12_months": "Raw data points for the trailing 12 months, including 'period_date_desc' and 'value_numeric', useful for deeper trend visualization or anomaly detection."
    }
  };

  async generateEconomicAnalysis(statisticalData: any): Promise<string> {
    try {
      log.info('🤖 Starting OpenAI economic analysis generation...');

      if (!statisticalData || Object.keys(statisticalData).length === 0) {
        log.error('❌ No statistical data provided for analysis');
        return 'No statistical data available for analysis.';
      }

      const prompt = this.buildAnalysisPrompt(statisticalData);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert economic analyst. Analyze the provided statistical data and provide insights according to the given instructions. Be concise but thorough in your analysis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: "text" }
      });

      const analysis = response.choices[0].message.content || 'Analysis generation failed.';
      
      log.info('✅ OpenAI economic analysis generated successfully');
      return analysis;

    } catch (error) {
      log.error('❌ Error generating OpenAI economic analysis:', error);
      return 'Economic analysis temporarily unavailable. Please try again later.';
    }
  }

  private buildAnalysisPrompt(statisticalData: any): string {
    const dataCount = Object.keys(statisticalData).reduce((total, category) => {
      return total + Object.keys(statisticalData[category]).length;
    }, 0);

    const prompt = `
ECONOMIC STATISTICAL ANALYSIS TASK

Instructions:
${this.analysisInstructions.analysis_instructions.map(instruction => `• ${instruction}`).join('\n')}

Statistical Data Schema:
${JSON.stringify(this.analysisInstructions.contextual_data_schema, null, 2)}

Statistical Data for Analysis (${dataCount} metrics across ${Object.keys(statisticalData).length} categories):
${JSON.stringify(statisticalData, null, 2)}

Please provide a focused economic analysis with ONLY these two sections:

Cross-Category Economic Health Synthesis
Analyze trends across all categories to identify key economic themes and interconnections.

Overall Economic Outlook
Provide a concise outlook based on the statistical evidence.

FORMAT REQUIREMENTS:
- Use plain text with section headers in bold (no markdown symbols like ## or **)
- Keep your response under 400 words total, focusing only on these two sections.
- Make section headers stand out but use plain formatting without symbols
`;

    return prompt;
  }
}

export const economicAnalysisOpenAIService = new EconomicAnalysisOpenAIService();