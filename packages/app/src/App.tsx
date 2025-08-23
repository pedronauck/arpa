import "./App.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ConvexClientProvider } from "@/lib/convexClient";
import { ChatInterface } from "@/components/chat-interface";
import { Toaster } from "sonner";

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <ConvexClientProvider>
        <ChatInterface />
        <Toaster position="top-left" richColors />
      </ConvexClientProvider>
    </ThemeProvider>
  );
}

export default App;
