import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from "./pages/landing";
import { Interview } from "./pages/interview";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/interview" element={<Interview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
