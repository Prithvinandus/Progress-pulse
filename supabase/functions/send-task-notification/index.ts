import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskNotificationRequest {
  assignee_email: string;
  assignee_name: string;
  assigner_email: string;
  assigner_name: string;
  task_desc: string;
  status: string;
  estimated_end_time: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      assignee_email,
      assignee_name,
      assigner_email,
      assigner_name,
      task_desc,
      status,
      estimated_end_time,
    }: TaskNotificationRequest = await req.json();

    console.log(`Sending task notification to ${assignee_email} from ${assigner_email}`);
    console.log(`Task details - Description: "${task_desc}", Status: ${status}, Estimated End: ${estimated_end_time}`);

    const emailResponse = await resend.emails.send({
      from: "Task Manager <manager@nandus.com>",
      to: [assignee_email],
      subject: "New Task Assignment",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New Task Assigned</h1>
          <p>Hello ${assignee_name},</p>
          <p>You have been assigned a new task by ${assigner_name} (${assigner_email}).</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #555; margin-top: 0;">Task Details</h2>
            <p><strong>Description:</strong> ${task_desc}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Estimated End Time:</strong> ${estimated_end_time}</p>
          </div>
          
          <p>Please log in to the Task Monitoring App to view and update this task.</p>
          
          <p style="color: #666; margin-top: 30px;">
            Best regards,<br>
            ${assigner_name}
          </p>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      throw new Error(emailResponse.error.message);
    }

    console.log(`Notification sent successfully for task: "${task_desc}" to ${assignee_email}`);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-task-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
