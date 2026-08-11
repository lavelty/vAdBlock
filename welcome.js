
// Theme loading
chrome.storage.local.get({ theme: 'default' }, (r) => {
    document.body.setAttribute('data-theme', r.theme);
});

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('openOptions');
    if (btn) {
        btn.addEventListener('click', () => {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open('options.html');
            }
        });
    }
});
