(function () {
    var rootEl = document.getElementById("react-bridge-root");
    if (!rootEl || !window.React || !window.ReactDOM) {
        return;
    }

    function ReactBridge() {
        return null;
    }

    var root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(ReactBridge));
})();
