const bcrypt = require('bcrypt');
const connection = require('./connect');

async function hashPassword(password){
    let salt = await bcrypt.genSalt(10);
    let result = bcrypt.hash(password, salt)
    .then(hash => {
        return hash;
    })
    .catch(err => {
        throw err;
    });
    return await result;
}

class User{

    static invalidLogin(){
        const err = new Error('Incorrect email or password given');
        err.status = 403;
        return err;
    }

    static async tryOperation(op, errMessage){
        try {
            let res = await op();
            return res;
        }
        catch(err){
            errMessage ? console.log(`${this.errPrefix}: ${errMessage}`) :
            console.log(`${this.errPrefix}: ${err.message}`);
            console.log(err.stack);
            
            if (errMessage?.includes('userInfo_email_key')){
                const err = new Error('An account with this email already exists');
                err.status = 400
            }

            if (!err.status){
                err.status = 500;
            }
            
            throw err;
        }
    }

    static async insertAccount(accountInfo){
        let password = await hashPassword(accountInfo.password);
        
        let result = await this.tryOperation(async () => {
            let res = await connection.transaction(
                async (client) => {
                    let uid = (await client.query('INSERT INTO public."userInfo"(uid,email,password) VALUES(DEFAULT, $1, $2) RETURNING uid',
                        [accountInfo.email, password])).rows[0].uid;
                    // console.log(data);
                    // console.log(data.rows);
                    // await client.query('INSERT INTO public."googleInfo"(uid), VALUES($1)',
                    // [accountInfo.uid, ])
                    console.log(uid);

                    await client.query('INSERT INTO public."googleInfo"(uid) VALUES($1)', 
                        [uid]);

                    await client.query('INSERT INTO public."spotifyInfo"(uid) VALUES($1)', 
                        [uid]);
                }
                
            );
            return res;
        });
        return result;
    }

    static async verifyAccountInfo(accountInfo){
        return await this.tryOperation(async () => {
            let result = await connection.singleDBQuery(
                'SELECT uid, password From public."userInfo" WHERE email = $1',
                [accountInfo.email]
            );
            
            if (result.rowCount === 0){
                throw this.invalidLogin();   
            }
            
            let userInfo = result.rows[0];
            
            let equal = await bcrypt.compare(accountInfo.password, userInfo.password);
            console.log(equal, accountInfo.password, userInfo.password);

            if (!equal){
                throw this.invalidLogin();
            }

            return userInfo.uid;
        })
        
    }

    static checkAuths(uid){
        this.tryOperation(async () => {
            await connection.singleDBQuery(`SELECT `)
        }, 'Could not check accounts linked')
    }

    static errPrefix = '[Error occured in User operation]'
}

module.exports = {
    User
}