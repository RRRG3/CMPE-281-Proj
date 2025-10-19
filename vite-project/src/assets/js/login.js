document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const toast = window.showToast || (() => {});

  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const username = loginForm.username.value.trim();
      const password = loginForm.password.value.trim();

      if (!username || !password) {
        toast('Please provide both username and password.', 'warning');
        return;
      }

      toast(`Welcome back, ${username}! Redirecting to your dashboard...`, 'success');
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 600);
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      toast('Password reset instructions have been sent to your email.', 'info');
    });
  }
});
