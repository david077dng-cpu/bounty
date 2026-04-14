import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Arena from './pages/Arena';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Courses from './pages/Courses';
import Dashboard from './pages/Dashboard';
import CreationCenter from './pages/CreationCenter';
import MCPConnections from './pages/MCPConnections';
import Chess from './pages/Chess';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/creation" element={<CreationCenter />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/arena/:taskId" element={<Arena />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/mcp-connections" element={<MCPConnections />} />
          <Route path="/chess" element={<Chess />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
