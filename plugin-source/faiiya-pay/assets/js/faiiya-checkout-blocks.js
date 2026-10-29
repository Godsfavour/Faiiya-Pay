(function () {
    if (!window.wc || !window.wc.wcBlocksRegistry || !window.wp || !window.wp.element) {
        return;
    }

    var registerPaymentMethod = window.wc.wcBlocksRegistry.registerPaymentMethod;
    var createElement = window.wp.element.createElement;
    var decodeEntities = (window.wp.htmlEntities && window.wp.htmlEntities.decodeEntities) || function (s) { return s; };

    function getSetting(key, fallback) {
        return (window.wc.wcSettings && window.wc.wcSettings.getSetting(key, fallback)) || fallback;
    }

    // 1. Register Faiiya Pay Wallet Block
    try {
        var walletData = getSetting('faiiya_pay_wallet_data', {});
        var walletTitle = decodeEntities(walletData.title || 'Faiiya Pay Digital Wallet');
        var walletDesc = decodeEntities(walletData.description || 'Pay instantly using your available digital wallet balance.');

        registerPaymentMethod({
            name: 'faiiya_pay_wallet',
            label: createElement('span', { style: { fontWeight: '600' } }, walletTitle),
            content: createElement('div', { style: { padding: '8px 0', fontSize: '13px', color: '#475569' } }, walletDesc),
            edit: createElement('div', { style: { padding: '8px 0', fontSize: '13px', color: '#475569' } }, walletDesc),
            canMakePayment: function () { return true; },
            ariaLabel: walletTitle,
            supports: {
                features: walletData.supports || ['products']
            }
        });
    } catch (e) {
        // Fail silent
    }

    // 2. Register Monnify Direct Block
    try {
        var monnifyData = getSetting('faiiya_pay_monnify_data', {});
        var monnifyTitle = decodeEntities(monnifyData.title || 'Debit Card / Bank Transfer / USSD (Monnify)');
        var monnifyDesc = decodeEntities(monnifyData.description || 'Pay securely with your ATM Card, Direct Bank Transfer, or USSD via Monnify.');

        registerPaymentMethod({
            name: 'faiiya_pay_monnify',
            label: createElement('span', { style: { fontWeight: '600' } }, monnifyTitle),
            content: createElement('div', { style: { padding: '8px 0', fontSize: '13px', color: '#475569' } }, monnifyDesc),
            edit: createElement('div', { style: { padding: '8px 0', fontSize: '13px', color: '#475569' } }, monnifyDesc),
            canMakePayment: function () { return true; },
            ariaLabel: monnifyTitle,
            supports: {
                features: monnifyData.supports || ['products']
            }
        });
    } catch (e) {
        // Fail silent
    }
})();
