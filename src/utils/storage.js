export function saveToHistory(cards) {
    const history = JSON.parse(localStorage.getItem('tarotHistory')) || [];
    history.push({ date: new Date().toLocaleString(), cards });
    localStorage.setItem('tarotHistory', JSON.stringify(history));
}

export function getHistory() {
    return JSON.parse(localStorage.getItem('tarotHistory')) || [];
}
