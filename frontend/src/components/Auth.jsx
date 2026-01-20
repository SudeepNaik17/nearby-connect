import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Allows browser to handle cookies automatically for JWT
axios.defaults.withCredentials = true;

// --- RENDER CONFIGURATION ---
// If you use Vite, use import.meta.env.VITE_API_URL
// If you use Create React App, use process.env.REACT_APP_API_URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Auth({ onLoginSuccess }) {
  // --- STATES ---
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // --- AUTO-HIDE MESSAGE EFFECT ---
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // --- FORM SUBMISSION ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage(''); 
    
    const endpoint = isLogin ? 'login' : 'register';
    
    try {
      // Use the dynamic API_URL here
      const response = await axios.post(`${API_URL}/api/${endpoint}`, {
        email: email.toLowerCase().trim(),
        password
      });
      
      if (isLogin) {
        setMessage("Login successful! Redirecting...");
        setTimeout(() => {
            onLoginSuccess(); 
        }, 1200);
      } else {
        setMessage("Account created! Please login now.");
        setEmail(email); 
        setPassword('');
        setTimeout(() => {
            setIsLogin(true);
        }, 2000);
      }
    } catch (err) {
      const status = err.response?.status;
      const errorText = err.response?.data?.error || "Connection failed. Please check your internet.";

      if (status === 409) {
        setError("This email is already registered. Try logging in!");
        setPassword('');
      } else {
        setError(errorText);
      }
      
      console.error("Auth Error:", errorText);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setError('');
    setMessage('');
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <p>{isLogin ? 'Login to access the map' : 'Register to get started'}</p>
      </div>

      {message && (
        <div className="success-toast" style={{ 
          backgroundColor: '#dcfce7', color: '#166534', padding: '14px', 
          borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem',
          fontWeight: '600', border: '1px solid #bbf7d0', display: 'flex',
          alignItems: 'center', gap: '8px', animation: 'fadeInScale 0.3s ease-out'
        }}>
          <span>✅</span> {message}
        </div>
      )}
      
      {error && (
        <div className="error-message" style={{ 
          color: '#991b1b', backgroundColor: '#fee2e2', padding: '14px', 
          borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem',
          fontWeight: '600', border: '1px solid #fecaca', display: 'flex',
          alignItems: 'center', gap: '8px', animation: 'fadeInScale 0.3s ease-out'
        }}>
          <span>❌</span> {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              disabled={loading}
              className="auth-input"
              required 
            />
        </div>
        
        <div className="input-group">
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              disabled={loading}
              className="auth-input"
              required 
            />
        </div>

        <button 
          type="submit" 
          className="auth-submit-btn" 
          disabled={loading}
        >
          {loading ? (
            <div className="spinner-small" style={{ margin: '0 auto' }}></div>
          ) : (
            isLogin ? 'Login to Map' : 'Register Account'
          )}
        </button>
      </form>
      
      <p className="toggle-text" style={{ marginTop: '25px', color: '#94a3b8' }}>
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <span 
            className="toggle-link" 
            onClick={toggleMode} 
            style={{ 
                fontWeight: '700', color: '#3b82f6', cursor: 'pointer', marginLeft: '5px'
            }}
        >
          {isLogin ? 'Register Here' : 'Login Here'}
        </span>
      </p>
    </div>
  );
}