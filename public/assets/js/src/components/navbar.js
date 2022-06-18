document.getElementById("search-checkbox").addEventListener("change", function (e) {
    console.log("a");
    if (e.target.checked) {
        console.log("b");
        setTimeout(function () {
            const input = document.getElementById("nav-search-input");
            input.focus();
        }, 100);
    }
});
