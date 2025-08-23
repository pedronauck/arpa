import "./App.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ConvexClientProvider } from "@/lib/convexClient";
import { ChatInterface } from "@/components/chat-interface";

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <ConvexClientProvider>
        <ChatInterface />
      </ConvexClientProvider>
    </ThemeProvider>
  );
}

export default App;