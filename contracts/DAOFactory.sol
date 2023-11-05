// EIP 1167 https://eips.ethereum.org/EIPS/eip-1167 - ERC-1167: Minimal Proxy Contract

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./DAO.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract DAOFactory is Ownable {
    //~~~~ Libraries ~~~~

    //~~~~ State variables ~~~~~
    address public templateDAO;
    address[] public daosCreated;

    event NewClone(address indexed _instance);

    constructor(address template) {
        templateDAO = template;
    }

    function createDAO() public onlyOwner returns (address) {
        address clone = Clones.clone(templateDAO);
        DAO(clone).initialize(msg.sender);
        daosCreated.push(clone);
        emit NewClone(clone);

        return clone;
    }

    //~~~~ Functions ~~~~
    //get # of total daos
    //get each dao details (index argument)
    //
}
