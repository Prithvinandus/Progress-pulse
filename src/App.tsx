
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import HomePage from "@/components/HomePage";
import TasksPage from "./pages/TasksPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import AdminTaskDetailsPage from "@/components/AdminTaskDetailsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route 
            path="/admin/task-details"
            element={
              <AuthLayout>
                {(user, session) => <AdminTaskDetailsPage user={user} session={session} />}
              </AuthLayout>
            }
          />
          <Route 
            path="/" 
            element={
              <AuthLayout>
                {(user, session) => <HomePage user={user} session={session} />}
              </AuthLayout>
            } 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
