export const saveRedirectPath = (path) => {
  if (path) {
    localStorage.setItem('authRedirectPath', path.startsWith('/') ? path : `/${path}`);
  }
};

export const getAndClearRedirectPath = () => {
  const path = localStorage.getItem('authRedirectPath');
  localStorage.removeItem('authRedirectPath');
  return path;
};

export const redirectToSavedPath = () => {
  const path = getAndClearRedirectPath();
  if (path) {
    window.location.href = `/#${path}`;
    return true;
  }
  return false;
};
