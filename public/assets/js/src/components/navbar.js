document.getElementById("search-checkbox").addEventListener("change", function (e) {
    if (e.target.checked) {
        setTimeout(function () {
            const input = document.getElementById("nav-search-input");
            input.focus();
        }, 100);
    }
});