(function () {
    // Nav items popup function to use add the below to html as data attributes
    // data-trigger=<popupID>
    // data-popup=<popupID>
    function showPopup(e) {
        const activePopups = document.querySelectorAll("[data-popup].popup-active");
        const isMobile = document.getElementById("mobile-menu-button").offsetParent; //offset parent is null with display none
        const triggerElem = e.target.closest("[data-trigger]");
        if (triggerElem && !triggerElem.classList.contains("popup-active")) {
            setTimeout(function () {
                const elemToTrigger = triggerElem.dataset.trigger;
                triggerElem.classList.add("popup-active");
                document.querySelector("[data-popup='" + elemToTrigger + "']").classList.add("popup-active");
            }, 0);
        }

        if (isMobile) {
            if (triggerElem && triggerElem.classList.contains("popup-active")) {
                const elemToTrigger = triggerElem.dataset.trigger;
                triggerElem.classList.remove("popup-active");
                document.querySelector("[data-popup='" + elemToTrigger + "']").classList.remove("popup-active");
            }
        } else {
            Array.from(activePopups).forEach(function (activePopup) {
                const popupId = activePopup.dataset.popup;
                if (!activePopup.contains(e.target)) {
                    activePopup.classList.remove("popup-active");
                    document.querySelector("[data-trigger='" + popupId + "']").classList.remove("popup-active");
                }
            });
        }
    }
    document.addEventListener("click", showPopup);

    ///////////////////////

    //
    // search bar popup functionality
    //
    function showSearch(e) {
        let searchbox = document.getElementById("search-box");
        if (!searchbox.classList.contains("search-box-active")) {
            searchbox.classList.add("search-box-active");
        }
        setTimeout(function () {
            document.addEventListener("click", hideSearch);
            const input = document.getElementById("nav-search-input");
            input.focus();
        }, 100);

        Array.from(document.getElementsByClassName("search-button")).forEach(function (elem) {
            elem.removeEventListener("click", showSearch);
        });
    }

    function hideSearch(e) {
        const searchbox = document.getElementById("search-box");
        const container = document.querySelector("#search-box > div");
        const closeCross = document.getElementById("close-cross");
        if (!container.contains(e.target) || closeCross.contains(e.target)) {
            if (searchbox.classList.contains("search-box-active")) {
                searchbox.classList.remove("search-box-active");
                Array.from(document.getElementsByClassName("search-button")).forEach(function (elem) {
                    elem.addEventListener("click", showSearch, { once: true });
                });
                document.removeEventListener("click", hideSearch);
            }
        }
    }
    Array.from(document.getElementsByClassName("search-button")).forEach(function (elem) {
        elem.addEventListener("click", showSearch, { once: true });
    });
    ////////////
})();
