const sha256=require('sha256')

var express=require('express')
var app=express();

const blockchain =require('./blockchain')

const bitcoin=new blockchain();

const bodyParser=require("body-parser")
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))

const uuid= require('uuid/v1')
const nodeAddress= uuid().split('-').join('')

const port=process.argv[2];

const rp=require("request-promise");



console.log('Server started')

var LocalStorage= require("node-localstorage").LocalStorage;
ls= new LocalStorage('./scratch/'+port);

app.get('/blockchain', function (req,res) {
    res.send(bitcoin);
})


app.post('/add-policy-and-broadcast', function (req,res) {
    if(bitcoin.currentNodeUrl!=='http://localhost:3001'){
        res.json({
            note: "permission denied"
        })
    }else{
        const policyBlock= bitcoin.createPolicyBlock(req.body.requester, req.body.requestee, req.body.permission);
        var present=0;
        bitcoin.policies.forEach(policy=>{

            if(JSON.stringify(policy)===JSON.stringify(policyBlock)){
                present=1;
            }
        })

        if(present===1){
            res.json({
                note: "Policy already present"
            })
        }else {
            bitcoin.policies.push(policyBlock);
            const requestPromises=[];
            bitcoin.networkNodes.forEach(networkNodeUrl=>{
                const requestOptions={
                    uri: networkNodeUrl + "/add-policy",
                    method: "POST",
                    body: policyBlock,
                    json: true
                }

                requestPromises.push(rp(requestOptions));
            })

            Promise.all(requestPromises)
                .then(data=>{
                    res.json({
                        note: "Policy added and broadcast successfully"
                    })
                })

        }
    }

})

app.post("/add-policy", function (req,res) {
    const policyBlock= bitcoin.createPolicyBlock(req.body.requester, req.body.requestee, req.body.permission);
    var present=0;
    bitcoin.policies.forEach(policy=>{

        if(JSON.stringify(policy)===JSON.stringify(policyBlock)){
            present=1;
        }
    })

    if(present===1){
        res.json({
            note: "Policy already present"
        })
    }else{
        bitcoin.policies.push(policyBlock);
        res.json({
            note: "policy added successfully"
        })
    }
})


app.post('/transaction/broadcast', function (req,res) {

    let filename= req.body.filename;
    console.log("filename--->"+filename);
    const filedata= ls.getItem(filename);
    console.log(filedata);
    const datahash= sha256(filename+""+filedata);
    const newTransaction= bitcoin.createNewTransaction(req.body.filename, req.body.sender, req.body.recipient, datahash)
    bitcoin.addTransactionToPendingTransactions(newTransaction);

   const requestPromises=[]
   bitcoin.networkNodes.forEach(networkNodeUrl=>{
       const requestOptions={
           uri: networkNodeUrl+ "/transaction",
           method: "POST",
           body: newTransaction,
           json: true
       }

       requestPromises.push(rp(requestOptions))
   })

   Promise.all(requestPromises)
       .then(data=>{
           res.json({note: "Transaction created and broadcast successfully"})
       })
})

app.post('/transaction', function (req,res) {
   const newTransaction= req.body;
   const blockIndex=bitcoin.addTransactionToPendingTransactions(newTransaction);
   res.json({note:`transaction will be added in block ${blockIndex} `});
})

app.get('/mine', function (req,res) {

  const lastBlock= bitcoin.getLastBlock();
  const previousBlockHash=lastBlock.hash;
  const currentBlockData={
      transactions: bitcoin.pendingTransactions,
      index: lastBlock.index+ 1
  }
  const nonce=bitcoin.proofOfWork(previousBlockHash, currentBlockData )
  const blockHash=bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce)


  const newBlock= bitcoin.createNewBlock(nonce, previousBlockHash, blockHash)

  const requestPromises=[]
  bitcoin.networkNodes.forEach(networkNodeUrl=>{
      const requestOptions={
          uri: networkNodeUrl+ "/receive-new-block",
          method: "POST",
          body: {newBlock: newBlock},
          json: true
      }

      requestPromises.push(rp(requestOptions))
  })

  Promise.all(requestPromises)

      .then(data=>{
          res.json({
              note: "new block mined and broadcast successfully",
              block: newBlock
          })
      })

})

app.post("/receive-new-block", function (req,res) {
    const newBlock=req.body.newBlock;
    const lastBlock= bitcoin.getLastBlock();
    const correctHash = lastBlock.hash===newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] +1 === newBlock['index'];
    if(correctHash&&correctIndex){
        bitcoin.chain.push(newBlock);
        bitcoin.pendingTransactions=[];
        res.json({note: "New block received and accepted",
                    newBlock: newBlock
        })
    }else{
        res.json({note: "New Block rejected",
                newBlock: newBlock
        })
    }



    res.json({note: "Block added successfully"})
})

// register a node and broadcast it to the network
app.post('/register-and-broadcast-node', function (req,res) {

    if(bitcoin.currentNodeUrl!=='http://localhost:3001'){
        res.json({
            note: "Request not made on master node"
        })
    }else{
        // Add node to present node(to which request is made)
        const newNodeUrl=req.body.newNodeUrl;
        if(bitcoin.networkNodes.indexOf(newNodeUrl)==-1&&newNodeUrl!==bitcoin.currentNodeUrl){
            bitcoin.networkNodes.push(newNodeUrl);
        }
        //Broadcast it to other nodes by requesting on '/register-node'
        const regNodesPromises= [];
        bitcoin.networkNodes.forEach(networkNodeUrl => {
            const requestOptions={
                uri: networkNodeUrl+ '/register-node',
                method: 'POST',
                body: {newNodeUrl: newNodeUrl},
                json: true
            }

            regNodesPromises.push(rp(requestOptions)
                .catch(function (err) {

                }));
        })

        Promise.all(regNodesPromises)
            .then(data =>{
                const bulkRegisterOptions={
                    uri: newNodeUrl + '/register-nodes-bulk',
                    method: 'POST',
                    body: {
                        allNetworkNodes: bitcoin.networkNodes.concat(bitcoin.currentNodeUrl),
                        policies: bitcoin.policies,
                        pendingTransactions: bitcoin.pendingTransactions
                    },
                    json: true
                }

                return rp(bulkRegisterOptions)
                    .catch(function (err) {

                    });
            })
            .then(data =>{
                const addFilesPromises=[];
                const requestOptions={
                    uri: newNodeUrl+'/register-all-files',
                    method: 'GET',
                    json: true
                }

                addFilesPromises.push(rp(requestOptions))


                Promise.all(addFilesPromises)
                    .then(
                        res.json({note: 'New node registered with network successfully'})
                    )
            })

    }


})



//register a node with the network
app.post('/register-node', function (req,res) {
    const newNodeUrl= req.body.newNodeUrl;
    if(bitcoin.networkNodes.indexOf(newNodeUrl)==-1&& newNodeUrl!==bitcoin.currentNodeUrl){
        bitcoin.networkNodes.push(newNodeUrl)
    }
    res.json({note: 'New node registered successfully'})
})

//register all nodes at once on newNode(request made on newNode)
app.post('/register-nodes-bulk', function (req,res) {
    const allNetworkNodes= req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl=>{
        if(bitcoin.networkNodes.indexOf(networkNodeUrl)==-1&&networkNodeUrl!==bitcoin.currentNodeUrl){
            bitcoin.networkNodes.push(networkNodeUrl);
        }
    })

    bitcoin.policies= req.body.policies;
    bitcoin.pendingTransactions= req.body.pendingTransactions

    res.json({note: "Bulk registration successful..."})
})

app.get('/register-all-files', function (req,res) {

    const addFilesPromises=[]
    const len= ls.length;
    for(var i=0;i<len;i++){
        const requestOptions={
            uri: bitcoin.currentNodeUrl+'/transaction/broadcast',
            method:'POST',
            body:{
                filename: ls.key(i),
                sender: bitcoin.currentNodeUrl,
                recipient: bitcoin.currentNodeUrl

            },
            json: true
        }
        addFilesPromises.push(rp(requestOptions));
    }

    Promise.all(addFilesPromises)
        .then(
            res.json({
                note: "all files registered successfully"
            })
        )
})


app.get("/consensus", function (req,res) {
    const requestPromises=[];
    bitcoin.networkNodes.forEach(networkNodeUrl=>{
        const requestOptions={
            uri: networkNodeUrl+"/blockchain",
            method:"GET",
            json: true
        }

        requestPromises.push(rp(requestOptions))
    })

    Promise.all(requestPromises)
        .then(blockchains=>{
           const currentChainLength=bitcoin.chain.length;
           let maxChainLength=currentChainLength;
           let newLongestChain=null;
           let newPendingTransactions=null;
           let newPolicies= null;
            blockchains.forEach(blockchain =>{
                if(blockchain.chain.length>maxChainLength){
                    maxChainLength=blockchain.chain.length;
                    newLongestChain=blockchain.chain;
                    newPendingTransactions=blockchain.pendingTransactions;
                    newPolicies= blockchain.policies;
                }
            })

            if(!newLongestChain||(newLongestChain&&!bitcoin.chainIsValid(newLongestChain))){
                res.json({
                    note:'Current chain has not been replaced',
                    chain: bitcoin.chain
                })
            }
            else if(newLongestChain&&bitcoin.chainIsValid(newLongestChain)){
                bitcoin.chain=newLongestChain;
                bitcoin.pendingTransactions=newPendingTransactions;
                bitcoin.policies= newPolicies;
                res.json({
                    note:"This chain has been replaced",
                    chain: bitcoin.chain
                })
            }
        })
})


app.get("/block/:blockHash", function (req,res) {
    const blockHash=req.params.blockHash;
    const correctBlock=bitcoin.getBlock(blockHash);
    res.json({
        block: correctBlock
    })
})

app.get("/transaction/:transactionId", function (req,res) {
    const transactionId=req.params.transactionId;
    const transactionData=bitcoin.getTransaction(transactionId)
    res.json({
        transaction: transactionData.transaction,
        block: transactionData.block
    })
})

app.get("/address/:address", function (req,res) {
    const address=req.params.address;
    const addressData=bitcoin.getAddressData(address);
    res.json({
        addressData: addressData
    })
})

app.get('/block-explorer', function (req,res) {
    res.sendfile('./block-explorer/index.html',{root: __dirname});
})

app.post('/store-data', function (req,res) {

    const data= req.body.data;
    const filename= req.body.filename;
    ls.setItem(filename, data);
    res.json({
        note: "added successfully",
        added: ls.getItem(filename),
        checking: ls.getItem('key')
    })
})


app.listen(port, function () {
    console.log(`Listening on port ${port}`)
})


