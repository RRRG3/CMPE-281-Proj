document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const roleButtons = document.querySelectorAll('.role-item');
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
        window.location.href = 'owner-dashboard.html';
      }, 600);
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
      event.preventDefault();
      toast('Password reset instructions have been sent to your email.', 'info');
    });
  }

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      toast('Loading role dashboard...', 'info');
      setTimeout(() => {
        window.location.href = target;
      }, 400);
    });
  });
});
