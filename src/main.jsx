import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { DiceProvider } from "./DiceContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DiceProvider>
          <App />
        </DiceProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
