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

/* ==================================================
   リアルタイム時刻
================================================== */

/*
   スマートフォンやパソコンの
   現在時刻を取得する。

   1秒ごとに更新するので、

   11:31
   ↓
   11:32
   ↓
   11:33

   のように自動的に変わる。
*/

function updateCurrentTime(){

    const now =
        new Date();


    const hours =
        String(
            now.getHours()
        ).padStart(2,"0");


    const minutes =
        String(
            now.getMinutes()
        ).padStart(2,"0");


    const time =
        hours +
        ":" +
        minutes;


    document
        .querySelectorAll(
            ".current-time"
        )
        .forEach(function(element){

            element.textContent =
                time;

        });

}


/*
   最初にすぐ表示
*/

updateCurrentTime();


/*
   1秒ごとに更新
*/

setInterval(
    updateCurrentTime,
    1000
);


/* ==================================================
   データ
================================================== */

// ==================================================
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

const questions = [

    "学校",

    "スマホ",

    "猫",

    "ゲーム",

    "コンビニ",

    "夏休み",

    "雨",

    "宇宙",

    "スポーツ",

    "ラーメン",

    "海",

    "映画",

    "時計",

    "料理",

    "旅行",

    "犬",

    "音楽",

    "朝",

    "お祭り",

    "宿題"

];


let soloQuestion = "";


let selectedIcon =
    localStorage.getItem(
        "nazokakeIcon"
    ) || "01";


let playerName =
    localStorage.getItem(
        "nazokakePlayer"
    ) || "プレイヤー名";


let currentRoom = null;


let friendTimer = null;


let soloTimer = null;


let soloTimeLeft = 90;


let friendTimeLeft = 90;


/* ==================================================
   画面切り替え
================================================== */

function show(id){

    if(soloTimer){

        clearInterval(
            soloTimer
        );

        soloTimer = null;

    }


    if(friendTimer){

        clearInterval(
            friendTimer
        );

        friendTimer = null;

    }


    document
        .querySelectorAll(".screen")
        .forEach(function(screen){

            screen.classList.remove(
                "active"
            );

        });


    const target =
        document.getElementById(id);


    if(target){

        target.classList.add(
            "active"
        );

    }


    window.scrollTo(
        0,
        0
    );


    /*
       画面を切り替えたときも
       現在時刻をすぐ反映
    */

    updateCurrentTime();

    /*
       画面操作はユーザー操作として扱われることが多いため、
       BGM再生をここでも試す。
    */
    if(bgmEnabled){
        startBGM();
    }

}


/* ==================================================
   トースト
================================================== */

function showToast(message){

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(function(){

        toast.classList.remove(
            "show"
        );

    },1800);

}


/* ==================================================
   ランダムお題
================================================== */

function pickQuestion(){

    return questions[
        Math.floor(
            Math.random() *
            questions.length
        )
    ];

}


/* ==================================================
   一人用開始
================================================== */

function startSolo(){

    soloQuestion = "";

    document.getElementById("soloQuestion").textContent = "AIがお題を考えています…";
    document.getElementById("soloFirstAnswer").value = "";
    document.getElementById("soloSecondAnswer").value = "";
    document.getElementById("soloAIError").style.display = "none";

    show("solo");
    startSoloTimer();

    generateAITopic().then(function(topic){
        soloQuestion = topic;
        document.getElementById("soloQuestion").textContent = "「" + topic + "」とかけまして";
    }).catch(function(error){
        document.getElementById("soloQuestion").textContent = "お題の生成に失敗しました";
        const el=document.getElementById("soloAIError");
        el.textContent="AIお題生成エラー：\n"+error.message;
        el.style.display="block";
    });

}



/* ==================================================
   一人用90秒カウントダウン
================================================== */

function startSoloTimer(){

    if(soloTimer){

        clearInterval(
            soloTimer
        );

    }


    soloTimeLeft = 90;


    const timer =
        document.getElementById(
            "soloTimer"
        );


    timer.textContent =
        "残り時間：90秒";

    timer.classList.remove(
        "warning"
    );


    soloTimer =
        setInterval(function(){

            soloTimeLeft--;


            timer.textContent =
                "残り時間：" +
                soloTimeLeft +
                "秒";


            if(soloTimeLeft <= 10){

                timer.classList.add(
                    "warning"
                );

            }


            if(soloTimeLeft <= 0){

                clearInterval(
                    soloTimer
                );

                soloTimer = null;

                submitSolo(true);

            }

        },1000);

}



/* ==================================================
   一人用回答
================================================== */

async function submitSolo(auto){

    if(auto === undefined){ auto = false; }

    if(soloTimer){ clearInterval(soloTimer); soloTimer=null; }

    const first = document.getElementById("soloFirstAnswer").value.trim();
    const second = document.getElementById("soloSecondAnswer").value.trim();
    const errorEl = document.getElementById("soloAIError");
    errorEl.style.display="none";

    if(!soloQuestion){
        showToast("AIがお題を作成中です。少し待ってください。");
        startSoloTimer();
        return;
    }

    if((!first || !second) && !auto){
        showToast("2か所とも入力してください");
        startSoloTimer();
        return;
    }

    const finalFirst = first || "時間切れ";
    const finalSecond = second || "回答なし";

    show("soloAI");

    try{
        const result = await scoreWithAI(soloQuestion,finalFirst,finalSecond);

        document.getElementById("soloScore").textContent = result.score + "点";
        document.getElementById("soloResultAnswer").textContent =
            "「" + soloQuestion + "」とかけまして\n" +
            "「" + finalFirst + "」とときます\n" +
            "その心は？ " + finalSecond;
        document.getElementById("soloComment").textContent = result.comment;
        show("soloResult");
    }catch(error){
        show("solo");
        errorEl.textContent="AI採点エラー：\n"+error.message;
        errorEl.style.display="block";
        startSoloTimer();
    }
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


/* ==================================================
   プレイヤー名変更
================================================== */

function changePlayerName(){

    const newName =
        prompt(
            "プレイヤー名を入力してください",
            playerName
        );


    if(!newName){

        return;

    }


    playerName =
        newName.trim();


    if(!playerName){

        return;

    }


    localStorage.setItem(
        "nazokakePlayer",
        playerName
    );


    updateProfile();


    showToast(
        "プレイヤー名を変更しました"
    );

}


/* ==================================================
   アイコン選択
================================================== */

function selectIcon(
    element,
    icon
){

    document
        .querySelectorAll(
            ".icon-choice"
        )
        .forEach(function(btn){

            btn.classList.remove(
                "selected"
            );

        });


    element.classList.add(
        "selected"
    );


    selectedIcon =
        icon;

}


/* ==================================================
   アイコン保存
================================================== */

function saveIcon(){

    localStorage.setItem(
        "nazokakeIcon",
        selectedIcon
    );


    updateProfile();


    showToast(
        "アイコンを変更しました"
    );


    setTimeout(function(){

        show(
            "profile"
        );

    },500);

}


/* ==================================================
   プロフィール反映
================================================== */

function updateProfile(){

    document.getElementById(
        "homePlayer"
    ).textContent =
        playerName;


    document.getElementById(
        "lobbyP1"
    ).textContent =
        playerName;


    document.getElementById(
        "resultPlayer"
    ).textContent =
        playerName;

}


/* ==================================================
   BGM設定
================================================== */

const bgmAudio = document.getElementById("bgmAudio");

let bgmEnabled =
    localStorage.getItem("nazokakeBgmEnabled") !== "false";

let bgmVolume =
    Number(
        localStorage.getItem("nazokakeBgmVolume") || "70"
    );

let seEnabled =
    localStorage.getItem("nazokakeSeEnabled") !== "false";

let voiceEnabled =
    localStorage.getItem("nazokakeVoiceEnabled") !== "false";


function applyBGMSettings(){

    if(!bgmAudio){
        return;
    }

    bgmAudio.volume =
        Math.max(
            0,
            Math.min(
                1,
                bgmVolume / 100
            )
        );

    updateBGMControls();

}


function startBGM(){

    if(!bgmAudio || !bgmEnabled){
        return;
    }

    /*
       スマホでは自動再生が制限されるため、
       ユーザーがボタンを押したタイミングで再生を試みる。
    */
    bgmAudio.play().catch(function(){

        /* 音源がまだ無い場合などは何もしない */

    });

}


function stopBGM(){

    if(!bgmAudio){
        return;
    }

    bgmAudio.pause();

}


function toggleBGM(){

    bgmEnabled =
        !bgmEnabled;

    localStorage.setItem(
        "nazokakeBgmEnabled",
        bgmEnabled
    );

    if(bgmEnabled){

        applyBGMSettings();
        startBGM();

    }
    else{

        stopBGM();

    }

    updateBGMControls();

}


function changeBGMVolume(value){

    bgmVolume =
        Number(value);

    localStorage.setItem(
        "nazokakeBgmVolume",
        bgmVolume
    );

    if(bgmAudio){

        bgmAudio.volume =
            bgmVolume / 100;

    }

    updateBGMControls();

}


function toggleSE(){

    seEnabled =
        !seEnabled;

    localStorage.setItem(
        "nazokakeSeEnabled",
        seEnabled
    );

    updateBGMControls();

}


function toggleVoice(){

    voiceEnabled =
        !voiceEnabled;

    localStorage.setItem(
        "nazokakeVoiceEnabled",
        voiceEnabled
    );

    updateBGMControls();

}


function updateBGMControls(){

    const bgmToggle =
        document.getElementById(
            "bgmToggle"
        );

    const bgmRange =
        document.getElementById(
            "bgmVolume"
        );

    const bgmValue =
        document.getElementById(
            "bgmVolumeValue"
        );

    const seToggle =
        document.getElementById(
            "seToggle"
        );

    const voiceToggle =
        document.getElementById(
            "voiceToggle"
        );


    if(bgmToggle){

        bgmToggle.textContent =
            bgmEnabled ? "ON" : "OFF";

        bgmToggle.classList.toggle(
            "on",
            bgmEnabled
        );

    }


    if(bgmRange){

        bgmRange.value =
            bgmVolume;

    }


    if(bgmValue){

        bgmValue.textContent =
            bgmVolume + "%";

    }


    if(seToggle){

        seToggle.textContent =
            seEnabled ? "ON" : "OFF";

        seToggle.classList.toggle(
            "on",
            seEnabled
        );

    }


    if(voiceToggle){

        voiceToggle.textContent =
            voiceEnabled ? "ON" : "OFF";

        voiceToggle.classList.toggle(
            "on",
            voiceEnabled
        );

    }

}


applyBGMSettings();
updateBGMControls();


/* ==================================================
   初期処理
================================================== */

updateProfile();

updateCurrentTime();
