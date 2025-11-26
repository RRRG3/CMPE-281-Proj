document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const toast = window.showToast || (() => {});

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = loginForm.username.value.trim();
      const password = loginForm.password.value.trim();

      if (!username || !password) {
        toast('Please provide both username and password.', 'warning');
        return;
      }

      try {
        // Call the actual login API
        const { post } = await import('./api.js');
        const data = await post('/api/v1/auth/login', {
          email: username,
          password: password
        });

        const data = await response.json();
        
        // Store tokens in localStorage
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));

        toast(`Welcome back, ${data.user.name}! Redirecting to your dashboard...`, 'success');
        setTimeout(() => {
          window.location.href = 'home.html';
        }, 600);
      } catch (error) {
        console.error('Login error:', error);
        toast('Login failed. Please try again.', 'error');
      }
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      toast('Password reset instructions have been sent to your email.', 'info');
    });
  }
});
