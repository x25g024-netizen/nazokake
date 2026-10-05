/* =====================================================
   Firebase
   ===================================================== */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =====================================================
   Firebase設定
   ===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyB1bqlXwpkWfrrZUxy898nxtgQ3DwV16_k",
    authDomain: "nazokake-51a39.firebaseapp.com",
    projectId: "nazokake-51a39",
    storageBucket: "nazokake-51a39.firebasestorage.app",
    messagingSenderId: "619204752710",
    appId: "1:619204752710:web:cca3f618562703edfd2147",
    measurementId: "G-PDDMGMHJBD"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* =====================================================
   ゲームデータ
   ===================================================== */
/ ==================================================
// AI設定（OpenRouter）
// ==================================================
// ここに自分のOpenRouter APIキーを入れてください。
const OPENROUTER_API_KEY = "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";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

async function callOpenRouter(messages){
    if(!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "APIキーをここに貼り付け"){
        throw new Error("OpenRouter APIキーが設定されていません。コード上部のOPENROUTER_API_KEYに貼り付けてください。");
    }

    const response = await fetch(OPENROUTER_ENDPOINT,{
        method:"POST",
        headers:{
            "Authorization":"Bearer " + OPENROUTER_API_KEY,
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            model:OPENROUTER_MODEL,
            temperature:0.7,
            messages:messages
        })
    });

    const data = await response.json();
    if(!response.ok){
        throw new Error(data?.error?.message || ("APIエラー HTTP " + response.status));
    }

    const content = data?.choices?.[0]?.message?.content;
    if(!content){
        throw new Error("AIから回答が返ってきませんでした。");
    }
    return content.trim();
}

async function generateAITopic(){
    const text = await callOpenRouter([
        {role:"system",content:"あなたは日本語のなぞかけのお題を作るAIです。"},
        {role:"user",content:"日本の専門学校生でも考えやすく、面白いなぞかけのお題を1つだけ作ってください。説明や答えは不要です。30文字以内で、お題の言葉だけを返してください。なぞかけなので○○とかけましての○○部分だけでいいです"}
    ]);
    return text.replace(/^「|」$/g,"").trim();
}

async function scoreWithAI(topic, first, second){
    const resultText = await callOpenRouter([
        {role:"system",content:"あなたは日本語のなぞかけを公平に採点するAIです。必ずJSONだけを返してください。形式は {\"score\":数字,\"comment\":\"短い日本語コメント\"} です。scoreは0から100の整数です。"},
        {role:"user",content:"次のなぞかけを採点してください。\n\nお題："+topic+"\nと説く："+first+"\nその心は："+second+"\n\n評価は、お題との関連性30点、なぞかけとしての成立度30点、発想力20点、面白さ20点を目安にしてください。コメントは2～4文程度で書いてください。"}
    ]);

    let parsed;
    try{
        const jsonMatch=resultText.match(/\{[\s\S]*\}/);
        parsed=JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
    }catch(e){
        const scoreMatch=resultText.match(/\b(100|[1-9]?\d)\b/);
        parsed={score:scoreMatch?Number(scoreMatch[1]):0,comment:resultText};
    }

    let score=Number(parsed.score);
    if(!Number.isFinite(score)) score=0;
    score=Math.max(0,Math.min(100,Math.round(score)));
    return {score:score,comment:parsed.comment || "AIからコメントが返ってきませんでした。"};
}
const topics = [
    "テスト",
    "学校",
    "夏休み",
    "コンビニ",
    "スマートフォン",
    "猫",
    "電車",
    "先生",
    "ラーメン",
    "ゲーム",
    "雨",
    "体育祭",
    "文化祭",
    "宿題",
    "アルバイト"
];


let username =
    localStorage.getItem("username") ||
    "プレイヤー名";

let currentTopic = "";
let currentRoomId = null;
let currentUserId = null;

let isHost = false;

let roomUnsubscribe = null;
let participantsUnsubscribe = null;
let answersUnsubscribe = null;

let friendTimerInterval = null;
let countdownInterval = null;

let hasSubmitted = false;
let resultShown = false;

let authReady = false;


/* =====================================================
   Firebase匿名ログイン
   ※ ここは1回だけ
   ===================================================== */

onAuthStateChanged(auth, (user) => {

    if (user) {

        currentUserId = user.uid;
        authReady = true;

        console.log(
            "Firebase User ID:",
            currentUserId
        );

        updateUsernameDisplay();

    }

});


signInAnonymously(auth)
    .then(() => {

        console.log(
            "Firebase匿名ログイン成功"
        );

    })
    .catch((error) => {

        console.error(
            "Firebase匿名ログインエラー:",
            error
        );

        alert(
            "Firebaseへの接続に失敗しました。\n\n" +
            "Firebase Authenticationの匿名ログインが有効か確認してください。"
        );

    });


/* =====================================================
   画面遷移
   ===================================================== */

window.navigateTo = function(targetViewId) {

    document
        .querySelectorAll(".app-container")
        .forEach(view => {

            view.classList.remove("active");

        });


    const target =
        document.getElementById(targetViewId);


    if (target) {

        target.classList.add("active");

    }

};


/* =====================================================
   ユーザー名
   ===================================================== */

function updateUsernameDisplay() {

    const elements = [
        "main-username",
        "solo-username"
    ];


    elements.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.textContent =
                username;

        }

    });

}


window.openUsernameScreen = function() {

    const input =
        document.getElementById(
            "username-input"
        );


    if (input) {

        input.value =
            username;

    }


    navigateTo(
        "view-username"
    );

};


window.changeUsername = function() {

    const input =
        document.getElementById(
            "username-input"
        );


    if (!input) {

        return;

    }


    const newName =
        input.value.trim();


    if (!newName) {

        alert(
            "ユーザー名を入力してください。"
        );

        return;

    }


    if (newName.length > 20) {

        alert(
            "ユーザー名は20文字以内にしてください。"
        );

        return;

    }


    username =
        newName;


    localStorage.setItem(
        "username",
        username
    );


    updateUsernameDisplay();


    alert(
        "ユーザー名を変更しました！"
    );


    navigateTo(
        "view-main"
    );

};


/* =====================================================
   お題
   ===================================================== */

function getRandomTopic() {

    return topics[
        Math.floor(
            Math.random() *
            topics.length
        )
    ];

}


/* =====================================================
   ソロ
   ===================================================== */

function updateSoloTopicDisplay() {

    const topic =
        document.getElementById(
            "solo-topic-display"
        );


    const kake =
        document.getElementById(
            "solo-kake-text"
        );


    if (topic) {

        topic.textContent =
            currentTopic;

    }


    if (kake) {

        kake.textContent =
            `「${currentTopic}」とかけて、`;

    }

}


window.startSoloGame = function() {

    currentTopic =
        getRandomTopic();


    updateSoloTopicDisplay();


    const totoku =
        document.getElementById(
            "solo-totoku-input"
        );


    const kokoro =
        document.getElementById(
            "solo-kokoro-input"
        );


    if (totoku) {

        totoku.value = "";

    }


    if (kokoro) {

        kokoro.value = "";

    }


    navigateTo(
        "view-solo-play"
    );

};


window.startSoloAgain = function() {

    startSoloGame();

};


window.submitSoloAnswer = function() {

    const totoku =
        document.getElementById(
            "solo-totoku-input"
        ).value.trim() ||
        "（無回答）";


    const kokoro =
        document.getElementById(
            "solo-kokoro-input"
        ).value.trim() ||
        "（無回答）";


    document.getElementById(
        "display-your-topic"
    ).textContent =
        currentTopic;


    document.getElementById(
        "display-your-kake"
    ).textContent =
        `「${currentTopic}」とかけて、`;


    document.getElementById(
        "display-your-totoku"
    ).textContent =
        `「${totoku}」ととく。`;


    document.getElementById(
        "display-your-kokoro"
    ).textContent =
        `その心は、「${kokoro}」`;


    const score =
        calculateScore(
            totoku,
            kokoro
        );


    document.getElementById(
        "display-score"
    ).textContent =
        score + "点";


    navigateTo(
        "view-loading"
    );


    setTimeout(() => {

        navigateTo(
            "view-result"
        );

    }, 1500);

};


/* =====================================================
   スコア
   ===================================================== */

function calculateScore(
    totoku,
    kokoro
) {

    if (
        totoku === "（無回答）" &&
        kokoro === "（無回答）"
    ) {

        return 0;

    }


    let score = 60;


    score += Math.min(
        totoku.length,
        15
    );


    score += Math.min(
        Math.floor(
            kokoro.length / 2
        ),
        20
    );


    return Math.min(
        score,
        100
    );

}


/* =====================================================
   部屋番号
   ===================================================== */

function generateRoomNumber() {

    return String(
        Math.floor(
            100000 +
            Math.random() * 900000
        )
    );

}


/* =====================================================
   部屋作成
   ===================================================== */

window.createRoom = async function() {

    console.log(
        "部屋作成開始"
    );


    if (!authReady || !currentUserId) {

        alert(
            "Firebaseに接続中です。\n" +
            "2～3秒待ってから、もう一度押してください。"
        );

        return;

    }


    try {

        const roomId =
            await createUniqueRoom();


        console.log(
            "作成する部屋番号:",
            roomId
        );


        currentRoomId =
            roomId;

        isHost = true;


        currentTopic =
            getRandomTopic();


        /* -----------------------------
           rooms/{roomId}
           ----------------------------- */

        await setDoc(
            doc(
                db,
                "rooms",
                roomId
            ),
            {

                hostId:
                    currentUserId,

                topic:
                    currentTopic,

                status:
                    "waiting",

                createdAt:
                    serverTimestamp(),

                roundStartedAt:
                    null

            }
        );


        console.log(
            "rooms作成成功"
        );


        /* -----------------------------
           participants/{uid}
           ----------------------------- */

        await setDoc(
            doc(
                db,
                "rooms",
                roomId,
                "participants",
                currentUserId
            ),
            {

                name:
                    username,

                uid:
                    currentUserId,

                host:
                    true,

                joinedAt:
                    serverTimestamp(),

                submitted:
                    false

            }
        );


        console.log(
            "参加者登録成功"
        );


        setupRoomListeners();


        navigateTo(
            "view-waiting-room"
        );


    } catch (error) {

        console.error(
            "部屋作成エラー:",
            error
        );


        alert(
            "部屋を作れませんでした。\n\n" +
            "エラー内容:\n" +
            error.message
        );

    }

};


/* =====================================================
   重複しない部屋番号
   ===================================================== */

async function createUniqueRoom() {

    for (
        let i = 0;
        i < 10;
        i++
    ) {

        const id =
            generateRoomNumber();


        const roomRef =
            doc(
                db,
                "rooms",
                id
            );


        const snapshot =
            await getDoc(
                roomRef
            );


        if (!snapshot.exists()) {

            return id;

        }

    }


    throw new Error(
        "空いている部屋番号を作れませんでした。"
    );

}


/* =====================================================
   部屋参加
   ===================================================== */

window.joinRoom = async function() {

    const input =
        document.getElementById(
            "room-number-input"
        );


    if (!input) {

        return;

    }


    const roomId =
        input.value.trim();


    if (!/^\d{6}$/.test(roomId)) {

        alert(
            "6桁の部屋番号を入力してください。"
        );

        return;

    }


    if (!authReady || !currentUserId) {

        alert(
            "Firebaseに接続中です。\n" +
            "少し待ってからもう一度お試しください。"
        );

        return;

    }


    try {

        const roomRef =
            doc(
                db,
                "rooms",
                roomId
            );


        const roomSnapshot =
            await getDoc(roomRef);


        if (!roomSnapshot.exists()) {

            alert(
                "その部屋は存在しません。"
            );

            return;

        }


        const room =
            roomSnapshot.data();


        if (
            room.status !==
            "waiting"
        ) {

            alert(
                "このゲームはすでに始まっています。"
            );

            return;

        }


        const participantRef =
            doc(
                db,
                "rooms",
                roomId,
                "participants",
                currentUserId
            );


        const participantSnapshot =
            await getDoc(
                participantRef
            );


        if (!participantSnapshot.exists()) {

            const allParticipants =
                await getParticipants(
                    roomId
                );


            if (
                allParticipants.length >= 5
            ) {

                alert(
                    "この部屋は満員です。"
                );

                return;

            }

        }


        currentRoomId =
            roomId;

        isHost = false;

        currentTopic =
            room.topic;


        await setDoc(
            participantRef,
            {

                name:
                    username,

                uid:
                    currentUserId,

                host:
                    false,

                joinedAt:
                    serverTimestamp(),

                submitted:
                    false

            }
        );


        setupRoomListeners();


        navigateTo(
            "view-waiting-room"
        );


    } catch (error) {

        console.error(
            "部屋参加エラー:",
            error
        );


        alert(
            "部屋への参加に失敗しました。\n\n" +
            error.message
        );

    }

};


/* =====================================================
   参加者取得
   ===================================================== */

async function getParticipants(
    roomId
) {

    const snapshot =
        await getDocs(
            collection(
                db,
                "rooms",
                roomId,
                "participants"
            )
        );


    return snapshot.docs.map(
        item => item.data()
    );

}


/* =====================================================
   部屋監視
   ===================================================== */

function setupRoomListeners() {

    removeRoomListeners();


    if (!currentRoomId) {

        return;

    }


    const roomRef =
        doc(
            db,
            "rooms",
            currentRoomId
        );


    roomUnsubscribe =
        onSnapshot(
            roomRef,
            snapshot => {

                if (!snapshot.exists()) {

                    alert(
                        "部屋が削除されました。"
                    );

                    leaveRoom();

                    return;

                }


                const room =
                    snapshot.data();


                currentTopic =
                    room.topic;


                updateRoomDisplays(
                    room
                );


                if (
                    room.status ===
                    "countdown"
                ) {

                    startCountdownScreen(
                        room.topic
                    );

                }


                if (
                    room.status ===
                    "playing"
                ) {

                    goToFriendInputView(
                        room.topic
                    );

                }


                if (
                    room.status ===
                    "result"
                ) {

                    showFriendResult();

                }

            },
            error => {

                console.error(
                    "部屋監視エラー:",
                    error
                );

            }
        );


    const participantsRef =
        collection(
            db,
            "rooms",
            currentRoomId,
            "participants"
        );


    participantsUnsubscribe =
        onSnapshot(
            participantsRef,
            snapshot => {

                const participants =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,
                            ...item.data()
                        })
                    );


                renderParticipants(
                    participants
                );


                checkEveryoneSubmitted(
                    participants
                );

            },
            error => {

                console.error(
                    "参加者監視エラー:",
                    error
                );

            }
        );


    const answersRef =
        collection(
            db,
            "rooms",
            currentRoomId,
            "answers"
        );


    answersUnsubscribe =
        onSnapshot(
            answersRef,
            snapshot => {

                updateAnswerWaitingStatus(
                    snapshot
                );


                if (resultShown) {

                    renderFriendResults(
                        snapshot
                    );

                }

            },
            error => {

                console.error(
                    "回答監視エラー:",
                    error
                );

            }
        );

}


/* =====================================================
   リスナー解除
   ===================================================== */

function removeRoomListeners() {

    if (roomUnsubscribe) {

        roomUnsubscribe();
        roomUnsubscribe = null;

    }


    if (participantsUnsubscribe) {

        participantsUnsubscribe();
        participantsUnsubscribe = null;

    }


    if (answersUnsubscribe) {

        answersUnsubscribe();
        answersUnsubscribe = null;

    }

}


/* =====================================================
   部屋表示
   ===================================================== */

function updateRoomDisplays(room) {

    const roomNumber =
        document.getElementById(
            "waiting-room-number"
        );


    const inputRoom =
        document.getElementById(
            "input-room-number"
        );


    if (roomNumber) {

        roomNumber.textContent =
            currentRoomId;

    }


    if (inputRoom) {

        inputRoom.textContent =
            currentRoomId;

    }


    const waitingTopic =
        document.getElementById(
            "waiting-topic"
        );


    if (waitingTopic) {

        waitingTopic.textContent =
            "お題：" +
            room.topic;

    }


    const startButton =
        document.getElementById(
            "start-friend-button"
        );


    if (startButton) {

        startButton.style.display =
            isHost
                ? "block"
                : "none";

    }

}


/* =====================================================
   参加者表示
   ===================================================== */

function renderParticipants(
    participants
) {

    const containers = [

        document.getElementById(
            "participant-list"
        ),

        document.getElementById(
            "input-participant-list"
        )

    ];


    containers.forEach(
        container => {

            if (!container) {

                return;

            }


            container.innerHTML = "";


            participants.forEach(
                player => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "player-list-item";


                    const icon =
                        document.createElement(
                            "div"
                        );

                    icon.className =
                        "player-icon";


                    if (
                        player.uid ===
                        currentUserId
                    ) {

                        icon.classList.add(
                            "player-icon-dark"
                        );

                    }


                    const name =
                        document.createElement(
                            "div"
                        );

                    name.className =
                        "player-name";

                    name.textContent =
                        player.name +
                        (
                            player.uid ===
                            currentUserId
                                ? " (あなた)"
                                : ""
                        );


                    const status =
                        document.createElement(
                            "div"
                        );

                    status.className =
                        "player-score";


                    if (player.host) {

                        status.textContent =
                            "ホスト";

                    } else if (
                        player.submitted
                    ) {

                        status.textContent =
                            "提出済み";

                        status.classList.add(
                            "ready"
                        );

                    } else {

                        status.textContent =
                            "回答中";

                    }


                    row.appendChild(
                        icon
                    );

                    row.appendChild(
                        name
                    );

                    row.appendChild(
                        status
                    );


                    container.appendChild(
                        row
                    );

                }
            );


            const title =
                container.id ===
                "participant-list"
                    ? document.getElementById(
                        "participant-title"
                    )
                    : document.getElementById(
                        "input-participant-title"
                    );


            if (title) {

                title.textContent =
                    `参加中のプレイヤー (${participants.length}/5)`;

            }

        }
    );

}


/* =====================================================
   部屋番号コピー
   ===================================================== */

window.copyRoomNumber = function() {

    if (!currentRoomId) {

        return;

    }


    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard
            .writeText(currentRoomId)
            .then(() => {

                alert(
                    "部屋番号をコピーしました！"
                );

            })
            .catch(() => {

                alert(
                    "コピーできませんでした。\n" +
                    "部屋番号：" +
                    currentRoomId
                );

            });

    } else {

        alert(
            "部屋番号：" +
            currentRoomId
        );

    }

};


/* =====================================================
   ホストがゲーム開始
   ===================================================== */

window.startFriendMatch =
async function() {

    if (!isHost) {

        alert(
            "ゲーム開始はホストのみできます。"
        );

        return;

    }


    if (!currentRoomId) {

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                "rooms",
                currentRoomId
            ),
            {

                status:
                    "countdown",

                roundStartedAt:
                    serverTimestamp()

            }
        );


    } catch (error) {

        console.error(
            "ゲーム開始エラー:",
            error
        );


        alert(
            "ゲームを開始できませんでした。\n\n" +
            error.message
        );

    }

};


/* =====================================================
   カウントダウン
   ===================================================== */

function startCountdownScreen(topic) {

    const view =
        document.getElementById(
            "view-friend-round-start"
        );


    if (
        view &&
        view.classList.contains("active")
    ) {

        return;

    }


    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );

        countdownInterval = null;

    }


    navigateTo(
        "view-friend-round-start"
    );


    const topicDisplay =
        document.getElementById(
            "friend-topic-display"
        );


    if (topicDisplay) {

        topicDisplay.textContent =
            topic;

    }


    let count = 3;


    const timer =
        document.getElementById(
            "friend-countdown-timer"
        );


    timer.textContent =
        count;


    countdownInterval =
        setInterval(
            async () => {

                count--;


                if (count > 0) {

                    timer.textContent =
                        count;

                    return;

                }


                clearInterval(
                    countdownInterval
                );

                countdownInterval =
                    null;


                if (isHost) {

                    try {

                        await updateDoc(
                            doc(
                                db,
                                "rooms",
                                currentRoomId
                            ),
                            {

                                status:
                                    "playing"

                            }
                        );

                    } catch (error) {

                        console.error(
                            "プレイ開始エラー:",
                            error
                        );

                    }

                }

            },
            1000
        );

}


/* =====================================================
   フレンド回答画面
   ===================================================== */

function goToFriendInputView(topic) {

    navigateTo(
        "view-friend-input"
    );


    document.getElementById(
        "friend-topic-display-input-view"
    ).textContent =
        topic;


    document.getElementById(
        "friend-kake-text"
    ).textContent =
        `「${topic}」とかけて、`;


    document.getElementById(
        "friend-totoku-input"
    ).value = "";


    document.getElementById(
        "friend-kokoro-input"
    ).value = "";


    document.getElementById(
        "friend-input-area"
    ).style.display =
        "block";


    document.getElementById(
        "friend-submit-waiting"
    ).style.display =
        "none";


    hasSubmitted = false;
    resultShown = false;


    startFriendTimer();

}


/* =====================================================
   60秒タイマー
   ===================================================== */

function startFriendTimer() {

    if (friendTimerInterval) {

        clearInterval(
            friendTimerInterval
        );

    }


    let timeLeft = 60;


    const display =
        document.getElementById(
            "friend-input-timer"
        );


    display.textContent =
        `残り ${timeLeft}秒`;


    friendTimerInterval =
        setInterval(
            () => {

                timeLeft--;


                display.textContent =
                    `残り ${Math.max(
                        timeLeft,
                        0
                    )}秒`;


                if (
                    timeLeft <= 0
                ) {

                    clearInterval(
                        friendTimerInterval
                    );

                    friendTimerInterval =
                        null;


                    if (!hasSubmitted) {

                        submitFriendAnswer();

                    }

                }

            },
            1000
        );

}


/* =====================================================
   フレンド回答提出
   ===================================================== */

window.submitFriendAnswer =
async function() {

    if (hasSubmitted) {

        return;

    }


    if (
        !currentRoomId ||
        !currentUserId
    ) {

        return;

    }


    hasSubmitted = true;


    if (friendTimerInterval) {

        clearInterval(
            friendTimerInterval
        );

        friendTimerInterval = null;

    }


    const totoku =
        document.getElementById(
            "friend-totoku-input"
        ).value.trim() ||
        "（無回答）";


    const kokoro =
        document.getElementById(
            "friend-kokoro-input"
        ).value.trim() ||
        "（無回答）";


    const score =
        calculateScore(
            totoku,
            kokoro
        );


    try {

        await setDoc(
            doc(
                db,
                "rooms",
                currentRoomId,
                "answers",
                currentUserId
            ),
            {

                uid:
                    currentUserId,

                name:
                    username,

                topic:
                    currentTopic,

                totoku:
                    totoku,

                kokoro:
                    kokoro,

                score:
                    score,

                submittedAt:
                    serverTimestamp()

            }
        );


        await updateDoc(
            doc(
                db,
                "rooms",
                currentRoomId,
                "participants",
                currentUserId
            ),
            {

                submitted:
                    true

            }
        );


        document.getElementById(
            "friend-input-area"
        ).style.display =
            "none";


        document.getElementById(
            "friend-submit-waiting"
        ).style.display =
            "block";


    } catch (error) {

        console.error(
            "回答送信エラー:",
            error
        );


        hasSubmitted = false;


        alert(
            "回答を送信できませんでした。\n\n" +
            error.message
        );

    }

};


/* =====================================================
   提出状況
   ===================================================== */

function updateAnswerWaitingStatus(
    snapshot
) {

    const status =
        document.getElementById(
            "friend-waiting-status"
        );


    if (!status) {

        return;

    }


    status.textContent =
        `${snapshot.size}人が回答済み。` +
        " 他のプレイヤーを待っています...";

}


/* =====================================================
   全員回答済みか確認
   ===================================================== */

async function checkEveryoneSubmitted(
    participants
) {

    if (
        !currentRoomId ||
        participants.length === 0
    ) {

        return;

    }


    if (
        !participants.every(
            player =>
                player.submitted === true
        )
    ) {

        return;

    }


    if (!isHost) {

        return;

    }


    try {

        const roomSnapshot =
            await getDoc(
                doc(
                    db,
                    "rooms",
                    currentRoomId
                )
            );


        if (!roomSnapshot.exists()) {

            return;

        }


        const room =
            roomSnapshot.data();


        if (
            room.status !==
            "playing"
        ) {

            return;

        }


        await updateDoc(
            doc(
                db,
                "rooms",
                currentRoomId
            ),
            {

                status:
                    "result"

            }
        );


    } catch (error) {

        console.error(
            "結果移行エラー:",
            error
        );

    }

}


/* =====================================================
   結果画面
   ===================================================== */

function showFriendResult() {

    if (resultShown) {

        navigateTo(
            "view-friend-result"
        );

        return;

    }


    resultShown = true;


    navigateTo(
        "view-friend-result"
    );


    document.getElementById(
        "friend-result-topic"
    ).textContent =
        currentTopic;


    loadFriendResults();

}


/* =====================================================
   結果取得
   ===================================================== */

async function loadFriendResults() {

    if (!currentRoomId) {

        return;

    }


    try {

        const answersRef =
            collection(
                db,
                "rooms",
                currentRoomId,
                "answers"
            );


        const snapshot =
            await getDocs(
                answersRef
            );


        renderFriendResults(
            snapshot
        );


    } catch (error) {

        console.error(
            "結果取得エラー:",
            error
        );

    }

}


/* =====================================================
   結果表示
   ===================================================== */

function renderFriendResults(
    snapshot
) {

    const container =
        document.getElementById(
            "friend-answer-list"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    const answers =
        snapshot.docs.map(
            item => ({
                id:
                    item.id,
                ...item.data()
            })
        );


    answers.sort(
        (a, b) =>
            (b.score || 0) -
            (a.score || 0)
    );


    answers.forEach(
        answer => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "friend-answer-card";


            if (
                answer.uid ===
                currentUserId
            ) {

                card.classList.add(
                    "my-answer-card"
                );

            }


            const header =
                document.createElement(
                    "div"
                );

            header.className =
                "answer-card-header";


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "answer-player-name";

            name.textContent =
                answer.name +
                (
                    answer.uid ===
                    currentUserId
                        ? " (あなた)"
                        : ""
                );


            const score =
                document.createElement(
                    "span"
                );

            score.className =
                "answer-score";

            score.textContent =
                `${answer.score || 0}点`;


            const line1 =
                document.createElement(
                    "p"
                );

            line1.className =
                "answer-text";

            line1.textContent =
                `「${answer.topic}」とかけて、`;


            const line2 =
                document.createElement(
                    "p"
                );

            line2.className =
                "answer-text";

            line2.textContent =
                `「${answer.totoku}」ととく。`;


            const line3 =
                document.createElement(
                    "p"
                );

            line3.className =
                "answer-text";

            line3.textContent =
                `その心は、「${answer.kokoro}」`;


            header.appendChild(
                name
            );

            header.appendChild(
                score
            );


            card.appendChild(
                header
            );

            card.appendChild(
                line1
            );

            card.appendChild(
                line2
            );

            card.appendChild(
                line3
            );


            container.appendChild(
                card
            );

        }
    );

}


/* =====================================================
   もう一度遊ぶ
   ===================================================== */

window.startFriendAgain =
async function() {

    if (!isHost) {

        alert(
            "もう一度遊ぶを開始できるのはホストです。"
        );

        return;

    }


    if (!currentRoomId) {

        return;

    }


    try {

        const participants =
            await getParticipants(
                currentRoomId
            );


        for (
            const player
            of participants
        ) {

            await deleteDoc(
                doc(
                    db,
                    "rooms",
                    currentRoomId,
                    "answers",
                    player.uid
                )
            );


            await updateDoc(
                doc(
                    db,
                    "rooms",
                    currentRoomId,
                    "participants",
                    player.uid
                ),
                {

                    submitted:
                        false

                }
            );

        }


        currentTopic =
            getRandomTopic();


        await updateDoc(
            doc(
                db,
                "rooms",
                currentRoomId
            ),
            {

                topic:
                    currentTopic,

                status:
                    "countdown",

                roundStartedAt:
                    serverTimestamp()

            }
        );


        hasSubmitted = false;
        resultShown = false;


    } catch (error) {

        console.error(
            "再スタートエラー:",
            error
        );


        alert(
            "再スタートできませんでした。\n\n" +
            error.message
        );

    }

};


/* =====================================================
   部屋退出
   ===================================================== */

window.leaveRoom =
async function() {

    const roomId =
        currentRoomId;

    const userId =
        currentUserId;


    removeRoomListeners();


    if (roomId && userId) {

        try {

            await deleteDoc(
                doc(
                    db,
                    "rooms",
                    roomId,
                    "participants",
                    userId
                )
            );

        } catch (error) {

            console.error(
                "退出処理エラー:",
                error
            );

        }

    }


    currentRoomId = null;
    isHost = false;
    hasSubmitted = false;
    resultShown = false;


    if (friendTimerInterval) {

        clearInterval(
            friendTimerInterval
        );

        friendTimerInterval = null;

    }


    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );

        countdownInterval = null;

    }


    navigateTo(
        "view-main"
    );

};


/* =====================================================
   起動
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateUsernameDisplay();

    }
);
