// ==UserScript==
// @name         Mon Bloqueur de Pub Ultime
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Le script le plus puissant et le plus furtif pour bloquer les publicités sans être détecté.
// @author       Michel Laurence (Nascheka)
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration du script ---
    const DEBUG_MODE = true; // Mettez à 'false' une fois que tout fonctionne bien
    const HIDING_METHOD = 2; // Méthode de masquage par défaut (1: Taille réduite, 2: Hors écran, 3: Transparent)

    // Délai pour les ré-applications (en ms) - Utile pour les pubs chargées tardivement
    const DELAYED_BLOCK_TIME = 500; // 0.5 seconde après le chargement initial

    // Tentative de bloquer les scripts anti-adblock.
    // À ACTIVER AVEC PRUDION ! Peut casser les sites.
    const BLOCK_ANTI_ADBLOCK_SCRIPTS = false; // Mettez à 'true' si vous rencontrez beaucoup de détections

    // --- Fonction utilitaire pour logguer en mode debug ---
    function logDebug(message, element = null) {
        if (DEBUG_MODE) {
            if (element) {
                console.log(`%c[AdBlock ULTIME]%c ${message}`, 'color: #8A2BE2; font-weight: bold;', 'color: unset;', element);
            } else {
                console.log(`%c[AdBlock ULTIME]%c ${message}`, 'color: #8A2BE2; font-weight: bold;', 'color: unset;');
            }
        }
    }

    // --- Injection de styles CSS furtifs au chargement du document ---
    // Cette méthode est plus difficile à inverser par les sites.
    let styleSheet = null;

    function injectStealthCSS() {
        if (styleSheet) return; // N'injecter qu'une seule fois

        let css = '';
        const commonRules = `
            pointer-events: none !important; /* Empêche les clics sur les pubs */
            user-select: none !important; /* Empêche la sélection de texte */
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            opacity: 0 !important; /* Transparence comme filet de sécurité */
            z-index: -9999 !important; /* Assure que ce n'est pas au-dessus du contenu */
        `;

        switch (HIDING_METHOD) {
            case 1: // Réduire la taille
                css = `
                    width: 0px !important;
                    height: 0px !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: 0 !important;
                    ${commonRules}
                `;
                break;
            case 2: // Déplacer hors écran (méthode privilégiée)
                css = `
                    position: absolute !important;
                    left: -9999px !important;
                    top: -9999px !important;
                    width: 1px !important; /* Minimum pour certains tests de visibilité */
                    height: 1px !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: 0 !important;
                    ${commonRules}
                `;
                break;
            case 3: // Rendre transparent (peut être détecté via opacity ou dimensions)
                css = `
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 1px !important;
                    height: 1px !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: 0 !important;
                    ${commonRules}
                `;
                break;
        }

        // Ajoutez une classe unique pour marquer les éléments à masquer
        const stealthClassName = 'adblock-stealth-hide';
        css = `.${stealthClassName} { ${css} }`;

        // Injecte la feuille de style dans le HEAD
        GM_addStyle(css);
        logDebug(`Classe CSS furtive '${stealthClassName}' injectée. Méthode: ${HIDING_METHOD}`);
        styleSheet = document.createElement('style');
        styleSheet.textContent = css;
        document.head.appendChild(styleSheet);

        return stealthClassName;
    }

    const STEALTH_CLASS = injectStealthCSS();

    // --- Fonction pour appliquer la classe furtive aux éléments ciblés ---
    function applyBlockToElement(el) {
        if (el && el.nodeType === 1 && !el.hasAttribute('data-adblock-processed')) {
            el.classList.add(STEALTH_CLASS);
            el.setAttribute('data-adblock-processed', 'true');
            logDebug('Appliqué furtivement:', el);
        }
    }

    // --- Liste des sélecteurs de publicités à bloquer ---
    // Cette liste est cruciale. Vous devrez l'enrichir constamment.
    const adSelectors = [
        // Sélecteurs génériques
        '.ad', '.ads', '.advert', '.advertising', '.promo', '.banner', '.popup-ad',
        '[class*="ad-container"]', '[id*="ad-wrapper"]', '[class*="advertisement"]',
        '[class*="promo-block"]', '[id*="banner-ad"]', '[id*="ads-zone"]',
        '.ad-placeholder', '.ad-box', '.ad-space', '.sponsored-content',

        // Iframes publicitaires
        'iframe[src*="adserver"]', 'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]',
        'iframe[src*="adtech.com"]', 'iframe[src*="adnxs.com"]', 'iframe[src*="amazon-adsystem.com"]',
        'iframe[src*="openx.net"]', 'iframe[id*="adframe"]', 'iframe[class*="ad"]',

        // Conteneurs de pubs
        'div[id^="ad-"]', 'div[class^="ad-"]',
        'div[id*="slot"]', 'div[class*="slot"]',
        'div.google_ads_iframe', 'div[data-google-query-id]',
        'section[id*="ad"]', 'aside[class*="ad"]',

        // YouTube (sélecteurs très volatiles !)
        '.ytd-companion-ad-renderer', '.ytp-ad-overlay-slot', '.ytp-ad-module',
        '.ytp-ad-player-overlay-instream-info', '.ytp-ad-action-panel',
        '.ytp-ad-text-overlay', '#player-ads',
        'ytd-promoted-sparkles-web-renderer', 'ytd-display-ad-renderer',
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
        '#clarify-box', // Pubs textuelles sous les vidéos

        // Pop-ups, overlays, consentements de cookies (souvent utilisés pour les pubs)
        '.modal-ad', '.overlay-ad', '.cookie-consent-overlay',
        '.no-scroll', // Souvent appliqué au body pour les overlays

        // Réseaux sociaux et contenus sponsorisés (extrêmement volatils et risqués)
        '[data-testid="feed-ad"]', '[data-e2e="feed-ad"]',
        '[data-testid="masthead-ad"]',
        'div[aria-label="Contenu sponsorisé"]',
        '[data-content-type="ad"]', '[role="feed"] > div[data-ad-preview]',
        'a[href*="ads.twitter.com"]',
        // Sélecteurs pour des éléments vides qui sont censés contenir des pubs
        // TRÈS RISQUÉ : Peut casser la mise en page
        'div:not([id]):not([class]):empty',
        'div[style*="min-height: 250px;"]:empty',
        'div[style*="height: 90px;"]:empty',
        'div[style*="width: 300px;"]:empty',
        'div[style*="width: 728px;"]:empty',
    ];

    // --- Sélecteurs d'éléments qui pourraient tenter de réafficher les pubs ou détecter un adblock ---
    const antiAdblockSelectors = [
        '[class*="ad-blocker-detector"]', '[id*="adblock-alert"]', '.anti-adblock-overlay',
        'div[style*="z-index: 2147483647"]', // Souvent utilisé par les overlays anti-adblock
        'div[style*="opacity: 0.01;"]', // Un pixel caché pour la détection
    ];

    // --- Fonction principale pour appliquer le blocage ---
    function applyAdBlocking() {
        logDebug('Application des règles de blocage en mode ultime...');

        // 1. Appliquer les règles sur les pubs connues
        adSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(applyBlockToElement);
        });

        // 2. Appliquer les règles sur les éléments anti-adblock potentiels
        antiAdblockSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(applyBlockToElement);
        });
    }

    // --- Tenter de bloquer les scripts anti-adblock ---
    // Cette partie est expérimentale et peut casser des sites !
    if (BLOCK_ANTI_ADBLOCK_SCRIPTS) {
        logDebug('Tentative de bloquer les scripts anti-adblock...');

        // Bloquer des fonctions globales couramment utilisées par les scripts de détection
        // C'est une approche agressive.
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay) {
            // Intercepte les appels à setTimeout qui pourraient réafficher des pubs
            // ou lancer des scripts de détection après un délai.
            const callbackStr = callback.toString();
            if (callbackStr.includes('ad') || callbackStr.includes('pub') ||
                callbackStr.includes('blocker') || callbackStr.includes('detect')) {
                logDebug('Bloqué setTimeout suspect:', callbackStr);
                return; // Ne pas exécuter le setTimeout
            }
            return originalSetTimeout(callback, delay);
        };
        // Faires de même pour requestAnimationFrame, setInterval, etc. si nécessaire.

        // Redéfinir des propriétés du DOM que les pubs ou détecteurs pourraient utiliser
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get: function() {
            if (this.classList && this.classList.contains(STEALTH_CLASS)) return 0;
            return this._offsetWidth || (this._offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth').get.call(this));
        }});
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get: function() {
            if (this.classList && this.classList.contains(STEALTH_CLASS)) return 0;
            return this._offsetHeight || (this._offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight').get.call(this));
        }});
        // C'est très complexe et risqué, juste pour illustrer le concept.
    }


    // --- Observateur de mutations du DOM ---
    // Le MutationObserver est essentiel pour attraper les pubs chargées dynamiquement.
    const observerConfig = { childList: true, subtree: true };

    const observer = new MutationObserver(mutations => {
        let needsRecheck = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                // Si de nouveaux nœuds sont ajoutés, nous devons réappliquer le blocage.
                needsRecheck = true;
            }
        });
        if (needsRecheck) {
            applyAdBlocking();
        }
    });

    // --- Exécution du script ---

    // 1. Appliquer le blocage au plus tôt (avant que les scripts anti-adblock ne s'exécutent)
    // Cela nécessite `@run-at document-start`
    applyAdBlocking();

    // 2. Lancer l'observateur après que le DOM initial soit prêt
    // (document.body pourrait ne pas être disponible à document-start)
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, observerConfig);
        logDebug('Observateur de mutations DOM activé.');
        // Ré-appliquer après un court délai pour les éléments qui apparaissent un peu plus tard
        setTimeout(applyAdBlocking, DELAYED_BLOCK_TIME);
    });

    // Si DOMContentLoaded est déjà passé (ex: script exécuté tardivement), observer directement
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        observer.observe(document.body, observerConfig);
        logDebug('Observateur de mutations DOM activé (DOMContentLoaded déjà passé).');
        setTimeout(applyAdBlocking, DELAYED_BLOCK_TIME);
    }

    logDebug('Script de blocage de pub ULTIME démarré.');

})();
